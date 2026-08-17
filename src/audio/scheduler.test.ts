import { describe, expect, it } from "vitest";
import { FIXTURE_4_4 } from "../domain/fixtures";
import { FakeClock } from "./fake-clock";
import { LOOKAHEAD_SEC, Scheduler } from "./scheduler";

// FIXTURE_4_4: 4/4 × 2小節、bpmUnit=96、音符 tick = 0/144/288/480/576、total=768
// BPM120 では期待時刻 0, 0.75, 1.5, 2.5, 3.0（1周期 4.0 秒）
const FIRST_LOOP = [0, 0.75, 1.5, 2.5, 3.0];

const setup = () => {
  const clock = new FakeClock();
  return { clock, scheduler: new Scheduler(clock) };
};

/**
 * 25ms ごとに pump しながら時計を進める（実運用と同じ呼ばれ方を再現する）。
 * 刻み幅を足し込むと浮動小数点の誤差が溜まるので、整数のステップ数から都度算出し、
 * 最後は until ちょうどまで進める。
 */
export const runUntil = (clock: FakeClock, scheduler: Scheduler, until: number) => {
  const start = clock.now();
  const steps = Math.floor((until - start) / 0.025 + 1e-9);
  for (let i = 0; i <= steps; i++) {
    // 開始時刻自体に誤差が乗っていることがあるので、逆行しないように丸め込む
    clock.advanceTo(Math.max(clock.now(), Number((start + i * 0.025).toFixed(6))));
    scheduler.pump();
  }
  if (clock.now() < until) {
    clock.advanceTo(until);
    scheduler.pump();
  }
};

describe("先読み", () => {
  it("窓の中にあるイベントだけを予約する", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    expect(LOOKAHEAD_SEC).toBe(0.5);
    expect(clock.records.map((r) => r.time)).toEqual([0]);
  });

  it("25ms ごとに pump すると1周期がすべて鳴る", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 3.0);
    expect(clock.firedTimes).toEqual(FIRST_LOOP);
  });

  it("ループ境界で位相が連続する", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 4.0);
    expect(clock.firedTimes).toEqual([...FIRST_LOOP, 4.0]);
  });

  it("過去への予約を1件も出さない", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 10);
    expect(clock.lateSchedules).toEqual([]);
  });

  it("同じ打点を二重に鳴らさない", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 10);
    const ticks = clock.firedTicks;
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it("開始時刻をずらすと全体がその分ずれる", () => {
    const { clock, scheduler } = setup();
    clock.advanceTo(10);
    scheduler.start(FIXTURE_4_4, 120, 10);
    runUntil(clock, scheduler, 13.0);
    expect(clock.firedTimes).toEqual(FIRST_LOOP.map((t) => t + 10));
  });
});

describe("遅れたイベントの読み飛ばし", () => {
  it("メインスレッドが長く止まっても、過去の打点を予約しない", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);

    clock.advanceTo(3.0); // 3秒フリーズしたことにする
    scheduler.pump();

    expect(clock.lateSchedules).toEqual([]);
    // 0秒の音は鳴っている。0.75/1.5/2.5 は読み飛ばされ、3.0 だけが追加される
    expect(clock.firedTimes).toEqual([0, 3.0]);
    expect(scheduler.droppedCount).toBe(3);
  });
});

describe("停止", () => {
  it("まだ鳴っていない予約だけがキャンセルされる", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 2.1); // 2.5 の予約が入り、まだ鳴っていない

    expect(clock.pending.map((r) => r.time)).toEqual([2.5]);
    scheduler.stop();

    expect(clock.pending).toEqual([]);
    expect(clock.firedTimes).toEqual([0, 0.75, 1.5]); // 鳴った音は消えない
  });

  it("stop で generation が進み、保持する予約が空になる", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 1.0);
    const before = scheduler.currentGeneration;

    scheduler.stop();

    expect(scheduler.currentGeneration).toBe(before + 1);
    expect(scheduler.pendingCount).toBe(0);
    expect(scheduler.isPlaying).toBe(false);
  });

  it("停止後は pump しても何も起きない", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    scheduler.stop();
    const before = clock.records.length;
    runUntil(clock, scheduler, 5);
    expect(clock.records.length).toBe(before);
  });
});

describe("入力の検証", () => {
  it.each([0, -1, 39, 241, NaN, Infinity, 120.5])("不正な BPM %p を拒否する", (bpm) => {
    const { scheduler } = setup();
    expect(() => scheduler.start(FIXTURE_4_4, bpm as number, 0)).toThrow();
  });

  it("40 と 240 は受け付ける", () => {
    const { scheduler } = setup();
    expect(() => scheduler.start(FIXTURE_4_4, 40, 0)).not.toThrow();
    expect(() => scheduler.start(FIXTURE_4_4, 240, 0)).not.toThrow();
  });

  it("不正なパターンを拒否する", () => {
    const { scheduler } = setup();
    const broken = structuredClone(FIXTURE_4_4);
    broken.bars[0]!.items.push({ kind: "rest", duration: "8" }); // 小節長が合わない
    expect(() => scheduler.start(broken, 120, 0)).toThrow(/invalid pattern/i);
  });

  it("停止中の切替要求は例外になる", () => {
    const { scheduler } = setup();
    expect(() => scheduler.requestTempoChange(150)).toThrow(/not playing/);
  });
});

describe("二重 start", () => {
  it("前の予約が鳴り残らず、古いハイライトも消える", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 0.3); // 0.75 が予約済み・未発音

    scheduler.start(FIXTURE_4_4, 120, 1.0);
    runUntil(clock, scheduler, 1.1);

    expect(clock.firedTimes).toEqual([0, 1.0]);
    const gens = new Set(scheduler.drainHighlightsUpTo(999).map((h) => h.generation));
    expect(gens.size).toBe(1);
  });
});

describe("メモリ", () => {
  it("長時間再生しても保持する予約が増え続けない", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 60);
    expect(scheduler.pendingCount).toBeLessThanOrEqual(5);
  });
});

describe("ハイライト", () => {
  it("到来した分だけ取り出せ、取り出した分は消える", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 1.6);

    expect(scheduler.drainHighlightsUpTo(1.0).map((h) => h.noteId)).toEqual(["a1", "a2"]);
    expect(scheduler.drainHighlightsUpTo(1.6).map((h) => h.noteId)).toEqual(["a3"]);
    expect(scheduler.drainHighlightsUpTo(1.6)).toEqual([]);
  });
});
