import { describe, expect, it } from "vitest";
import { computeBeams } from "./beams";
import { toPlaybackEvents } from "./derive";
import { AFRO_GROOVE } from "./patterns/afro-groove";
import { AFRO_GROOVE_2 } from "./patterns/afro-groove-2";
import { AFRO_GROOVE_6_8 } from "./patterns/afro-groove-6-8";
import { IJEXA } from "./patterns/ijexa";
import { PATTERNS } from "./registry";
import { totalTicks } from "./ticks";
import { validatePattern } from "./validate";

describe("収録リズム", () => {
  it("すべてバリデータを通る", () => {
    for (const p of PATTERNS) {
      expect(`${p.id}: ${validatePattern(p).join("; ")}`).toBe(`${p.id}: `);
    }
  });

  it("id が重複しない", () => {
    const ids = PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("打点の id がパターン内で重複しない", () => {
    for (const p of PATTERNS) {
      const ids = toPlaybackEvents(p).map((e) => e.noteId);
      expect(`${p.id}: ${new Set(ids).size}`).toBe(`${p.id}: ${ids.length}`);
    }
  });
});

describe("Afro Groove", () => {
  it("3-2 Groove の1小節目を2回繰り返した形になっている", () => {
    const [first, second] = AFRO_GROOVE.bars;
    // id だけが違い、音価と休符の並びは同じ
    const shape = (b: typeof first) =>
      b!.items.map((i) => `${i.kind}:${i.duration}:${i.dots ?? 0}`);
    expect(shape(second)).toEqual(shape(first));
    expect(AFRO_GROOVE.bars).toHaveLength(2);
  });

  it("打点が 0 / 144 / 288 / 384 / 528 / 672 に並ぶ", () => {
    expect(toPlaybackEvents(AFRO_GROOVE).map((e) => e.tick)).toEqual([
      0, 144, 288, 384, 528, 672,
    ]);
  });

  it("1周期は 3-2 Groove と同じ 768 tick", () => {
    expect(totalTicks(AFRO_GROOVE)).toBe(768);
  });

  it("BPM は2分音符で数える（カットタイム）", () => {
    expect(AFRO_GROOVE.meter).toEqual({ beats: 2, beatUnit: 2, beatGroups: [1, 1] });
    expect(AFRO_GROOVE.bpmUnit).toBe(192);
  });
});

describe("Afro Groove (6/8)", () => {
  it("小節1は 0/2/4/5、小節2は 1/3/5 に打点が並ぶ（8分音符換算）", () => {
    expect(toPlaybackEvents(AFRO_GROOVE_6_8).map((e) => e.tick)).toEqual([
      0, 96, 192, 240, 336, 432, 528,
    ]);
  });

  it("小節1の末尾は8分音符2つが連桁される", () => {
    // ♩ ♩ ♪ ♪ の後半2つ（添字 2 と 3）。beatGroups [3,3] の第2グループ内
    expect(computeBeams(AFRO_GROOVE_6_8.bars[0]!, AFRO_GROOVE_6_8.meter)).toEqual([[2, 3]]);
  });

  it("1周期は 576 tick", () => {
    expect(totalTicks(AFRO_GROOVE_6_8)).toBe(576);
  });

  it("BPM は付点4分音符で数える", () => {
    expect(AFRO_GROOVE_6_8.meter).toEqual({ beats: 6, beatUnit: 8, beatGroups: [3, 3] });
    expect(AFRO_GROOVE_6_8.bpmUnit).toBe(144);
  });

  it("2小節目の最後は休符ではなく打点になっている", () => {
    const last = AFRO_GROOVE_6_8.bars[1]!.items.at(-1)!;
    expect(last.kind).toBe("note");
  });

  it("2小節目の8分音符は休符に挟まれるので連桁されない", () => {
    expect(computeBeams(AFRO_GROOVE_6_8.bars[1]!, AFRO_GROOVE_6_8.meter)).toEqual([]);
  });
});

describe("Afro Groove2", () => {
  it("2/2 の1小節に ●●・・●●・・ で打点が並ぶ", () => {
    // 8分音符換算で 0 / 1 / 4 / 5
    expect(toPlaybackEvents(AFRO_GROOVE_2).map((e) => e.tick)).toEqual([0, 48, 192, 240]);
  });

  it("1周期は 384 tick（2/2 の1小節）", () => {
    expect(totalTicks(AFRO_GROOVE_2)).toBe(384);
    expect(AFRO_GROOVE_2.bars).toHaveLength(1);
  });

  it("BPM は2分音符で数える（カットタイム）", () => {
    expect(AFRO_GROOVE_2.meter).toEqual({ beats: 2, beatUnit: 2, beatGroups: [1, 1] });
    expect(AFRO_GROOVE_2.bpmUnit).toBe(192);
  });

  it("隣り合う8分音符どうしが拍ごとに連桁される", () => {
    // ♪♪ 𝄽 ♪♪ 𝄽 → 添字 0-1 と 3-4
    expect(computeBeams(AFRO_GROOVE_2.bars[0]!, AFRO_GROOVE_2.meter)).toEqual([
      [0, 1],
      [3, 4],
    ]);
  });
});

// 再生中の切替で「新しいリズムの音が鳴った瞬間」を打点 id で判定している。
// id がパターンをまたいで重複すると、譜面が音より早く切り替わる。
it("打点の id はパターンをまたいでも重複しない", () => {
  const all = PATTERNS.flatMap((p) => toPlaybackEvents(p).map((e) => `${e.noteId}`));
  const duplicated = all.filter((id, i) => all.indexOf(id) !== i);
  expect(duplicated).toEqual([]);
});

describe("IJEXA", () => {
  it("カ＝8分・カン＝4分 として打点が並ぶ", () => {
    // 8分音符換算で 0 / 1 / 3 / 5 / 6（小節1）、8 / 10 / 12 / 14（小節2）
    expect(toPlaybackEvents(IJEXA).map((e) => e.tick)).toEqual([
      0, 48, 144, 240, 288, 384, 480, 576, 672,
    ]);
  });

  it("高低が「高高・低低低・高高・低低」に分かれる", () => {
    expect(toPlaybackEvents(IJEXA).map((e) => e.pitch)).toEqual([
      "high",
      "high",
      "low",
      "low",
      "low",
      "high",
      "high",
      "low",
      "low",
    ]);
  });

  it("高低の切り替わりは小節の真ん中と小節線", () => {
    // 小節1は前半が高・後半が低、小節2も前半が高・後半が低
    const byBar = [0, 1].map((bi) =>
      toPlaybackEvents(IJEXA)
        .filter((e) => Math.floor(e.tick / 384) === bi)
        .map((e) => e.pitch),
    );
    expect(byBar[0]).toEqual(["high", "high", "low", "low", "low"]);
    expect(byBar[1]).toEqual(["high", "high", "low", "low"]);
  });

  it("1周期は 768 tick（2/2 × 2小節）", () => {
    expect(totalTicks(IJEXA)).toBe(768);
    expect(IJEXA.bars).toHaveLength(2);
  });

  it("BPM は2分音符で数える（カットタイム）", () => {
    expect(IJEXA.meter).toEqual({ beats: 2, beatUnit: 2, beatGroups: [1, 1] });
    expect(IJEXA.bpmUnit).toBe(192);
  });
});
