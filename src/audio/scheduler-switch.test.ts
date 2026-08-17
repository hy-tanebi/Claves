import { describe, expect, it } from "vitest";
import { FIXTURE_4_4, FIXTURE_6_8 } from "../domain/fixtures";
import { FakeClock } from "./fake-clock";
import { Scheduler } from "./scheduler";

/** FIXTURE_4_4 を n 打点ぶん繰り返したときの絶対 tick の並び */
const LOOP_TICKS = [0, 144, 288, 480, 576];
const TOTAL_TICKS = 768;
const expectedTicks = (n: number): number[] =>
  Array.from(
    { length: n },
    (_, i) => Math.floor(i / LOOP_TICKS.length) * TOTAL_TICKS + LOOP_TICKS[i % LOOP_TICKS.length]!,
  );

const setup = () => {
  const clock = new FakeClock();
  return { clock, scheduler: new Scheduler(clock) };
};

const runUntil = (clock: FakeClock, scheduler: Scheduler, until: number) => {
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

/** 鳴った打点が、欠落も重複もなく期待の並びの先頭から続いていること */
const expectCleanTickRun = (clock: FakeClock) => {
  const ticks = clock.firedTicks;
  expect(ticks.length).toBeGreaterThan(0);
  expect(new Set(ticks).size).toBe(ticks.length); // 重複なし＝二重発音なし
  expect(ticks).toEqual(expectedTicks(ticks.length)); // 欠落・順序乱れなし
  expect(clock.lateSchedules).toEqual([]); // 過去への予約なし
};

/** 切替では予約の取り消しが一切発生しないこと（この設計の核心） */
const expectNoCancellation = (clock: FakeClock) => {
  expect(clock.records.filter((r) => r.cancelled)).toEqual([]);
};

describe("requestTempoChange", () => {
  it("次の拍境界から新しいテンポになる", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 0.3);

    // ここまでで tick 0（0秒）と tick 144（0.75秒）が予約済み。
    // 次の拍境界は tick 192 = 1.0 秒
    scheduler.requestTempoChange(240);
    expect(scheduler.pendingSwitchTick).toBe(192);

    runUntil(clock, scheduler, 2.0);

    // 切替前の2打点は旧テンポのまま
    expect(clock.firedTimes.slice(0, 2)).toEqual([0, 0.75]);
    // tick 288 は 1.0 + 96 * (60/240/96) = 1.25 秒
    expect(clock.firedTimes[2]).toBeCloseTo(1.25, 9);
  });

  it("切替で予約の取り消しが発生しない", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 0.3);

    scheduler.requestTempoChange(240);
    runUntil(clock, scheduler, 6);

    expectNoCancellation(clock);
    expectCleanTickRun(clock);
  });

  it("大きく遅くしても打点が欠落・重複しない（120 → 40）", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 0.9);

    scheduler.requestTempoChange(40);
    runUntil(clock, scheduler, 20);

    expectNoCancellation(clock);
    expectCleanTickRun(clock);
  });

  it("大きく速くしても打点が欠落・重複しない（120 → 240）", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 0.9);

    scheduler.requestTempoChange(240);
    runUntil(clock, scheduler, 20);

    expectNoCancellation(clock);
    expectCleanTickRun(clock);
  });

  it("テンポを変えなければ時刻列も変わらない", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 0.3);

    scheduler.requestTempoChange(120);
    runUntil(clock, scheduler, 3.2);

    expect(clock.firedTimes.map((t) => Math.round(t * 1e6) / 1e6)).toEqual([
      0, 0.75, 1.5, 2.5, 3.0,
    ]);
    expectNoCancellation(clock);
  });

  it("generation が進む", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 0.3);
    const before = scheduler.currentGeneration;

    scheduler.requestTempoChange(150);
    runUntil(clock, scheduler, 2.0);

    expect(scheduler.currentGeneration).toBe(before + 1);
  });

  it("連続してテンポを変えても壊れない", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);

    for (const bpm of [200, 60, 240, 40, 120]) {
      runUntil(clock, scheduler, clock.now() + 0.4);
      scheduler.requestTempoChange(bpm);
    }
    runUntil(clock, scheduler, 30);

    expectNoCancellation(clock);
    expectCleanTickRun(clock);
  });
});

describe("requestPatternChange", () => {
  it("次の拍境界から新パターンの先頭で鳴り始める", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 0.3);

    scheduler.requestPatternChange(FIXTURE_6_8, 120);
    const atTick = scheduler.pendingSwitchTick!;
    expect(atTick).toBe(192); // 1.0 秒

    runUntil(clock, scheduler, 2.0);

    // 6/8 / bpmUnit=144 / BPM120 → 先頭3音は tick 0 / 48 / 96
    const spt = 60 / 120 / 144;
    const after = clock.firedTimes.filter((t) => t >= 1.0);
    expect(after[0]).toBeCloseTo(1.0, 9);
    expect(after[1]).toBeCloseTo(1.0 + 48 * spt, 9);
    expect(after[2]).toBeCloseTo(1.0 + 96 * spt, 9);
  });

  it("切替で予約の取り消しが発生しない", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 0.3);

    scheduler.requestPatternChange(FIXTURE_6_8, 120);
    runUntil(clock, scheduler, 6);

    expectNoCancellation(clock);
    expect(clock.lateSchedules).toEqual([]);
  });

  it("切替後は旧パターンの音が鳴らない", () => {
    const { clock, scheduler } = setup();
    scheduler.start(FIXTURE_4_4, 120, 0);
    runUntil(clock, scheduler, 0.3);

    scheduler.requestPatternChange(FIXTURE_6_8, 120);
    runUntil(clock, scheduler, 6);

    // 旧パターンの b1 / b2（tick 480 / 576、1.0秒より後）は鳴らない
    expect(clock.fired.filter((r) => r.noteId.startsWith("b"))).toEqual([]);
    // 新パターンの音は鳴っている
    expect(clock.fired.filter((r) => r.noteId.startsWith("c")).length).toBeGreaterThan(0);
  });
});

describe("切替要求のタイミングを動かしても壊れない", () => {
  it("どの時点でテンポ変更を要求しても、打点が欠落も重複もしない", () => {
    for (let s = 0.05; s <= 3.0; s += 0.05) {
      const requestAt = Number(s.toFixed(6));
      const clock = new FakeClock();
      const scheduler = new Scheduler(clock);

      scheduler.start(FIXTURE_4_4, 120, 0);
      runUntil(clock, scheduler, requestAt);
      scheduler.requestTempoChange(120); // テンポは変えない
      runUntil(clock, scheduler, 3.2);

      expectNoCancellation(clock);
      expectCleanTickRun(clock);
      // テンポを変えていないので時刻列も元のまま
      expect(clock.firedTimes.map((t) => Math.round(t * 1e6) / 1e6)).toEqual([
        0, 0.75, 1.5, 2.5, 3.0,
      ]);
    }
  });
});
