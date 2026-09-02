import { describe, expect, it } from "vitest";
import { computeBeams } from "./beams";
import { toPlaybackEvents } from "./derive";
import { AFRO_GROOVE } from "./patterns/afro-groove";
import { AFRO_GROOVE_2 } from "./patterns/afro-groove-2";
import { AFRO_GROOVE_3 } from "./patterns/afro-groove-3";
import { AFRO_GROOVE_6_8 } from "./patterns/afro-groove-6-8";
import { AFRO_GROOVE_6_8_2 } from "./patterns/afro-groove-6-8-2";
import { IJEXA } from "./patterns/ijexa";
import { THREE_TWO_GROOVE } from "./patterns/three-two-groove";
import { THREE_TWO_GROOVE_2 } from "./patterns/three-two-groove-2";
import { PATTERNS } from "./registry";
import { ticksOf, totalTicks } from "./ticks";
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
  it("「カカンカカン」を2セット並べる", () => {
    // カ(8分=48) カン(音+間=144) で「カカン」が半小節 192 tick。
    // 「カカンカカン」で1小節 384 tick。それが2小節で1周期
    expect(toPlaybackEvents(AFRO_GROOVE_2).map((e) => e.tick)).toEqual([
      0, 48, 192, 240, 384, 432, 576, 624,
    ]);
  });

  it("1周期は 768 tick（2/2 の2小節）", () => {
    expect(totalTicks(AFRO_GROOVE_2)).toBe(768);
    expect(AFRO_GROOVE_2.bars).toHaveLength(2);
  });

  it("2小節はまったく同じ形", () => {
    const [first, second] = AFRO_GROOVE_2.bars;
    const shape = (b: typeof first) =>
      b!.items.map((i) => `${i.kind}:${i.duration}:${i.dots ?? 0}`);
    expect(shape(second)).toEqual(shape(first));
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

describe("6/8 Afro Groove 2", () => {
  it("カンカカン（♩ ♪ ♩.）を2小節繰り返す", () => {
    const ticks = toPlaybackEvents(AFRO_GROOVE_6_8_2).map((e) => e.tick);

    // 1小節 288 tick。カン(4分=96) カ(8分=48) カン(付点4分=144)
    // → 打点は小節頭・96・144。それが2小節
    expect(ticks).toEqual([0, 96, 144, 288, 384, 432]);
  });

  it("1周期は 6/8 × 2小節ぶん", () => {
    expect(totalTicks(AFRO_GROOVE_6_8_2)).toBe(576);
  });

  it("2小節はまったく同じ形", () => {
    const [first, second] = AFRO_GROOVE_6_8_2.bars;
    const shape = (b: typeof first) =>
      b!.items.map((i) => `${i.kind}:${i.duration}:${i.dots ?? 0}`);
    expect(shape(second)).toEqual(shape(first));
  });

  it("高低は打ち分けない（高低を使うのは IJEXA だけ）", () => {
    expect(toPlaybackEvents(AFRO_GROOVE_6_8_2).every((e) => e.pitch === "high")).toBe(true);
  });
});

describe("6/8 の名前", () => {
  it("6/8 のリズムは 6/8 Afro Groove で揃える", () => {
    expect(AFRO_GROOVE_6_8.name).toBe("6/8 Afro Groove 1");
    expect(AFRO_GROOVE_6_8_2.name).toBe("6/8 Afro Groove 2");
  });
});

describe("3-2 Groove2", () => {
  /**
   * 口唱歌「カンンカ ンンンカ ンンカン カンンン」。
   * 16マス＝8分音符換算で、打点は 0 / 3 / 7 / 10 / 12。
   * 1マス 48 tick なので 0 / 144 / 336 / 480 / 576
   */
  it("打点はルンバクラーベ 3-2 の位置にある", () => {
    expect(toPlaybackEvents(THREE_TWO_GROOVE_2).map((e) => e.tick)).toEqual([
      0, 144, 336, 480, 576,
    ]);
  });

  /**
   * **既存の 3-2 Groove との違いは3つ目の打点だけ。**
   * ソンクラーベ（6）とルンバクラーベ（7）の差で、
   * ここが同じになったら2曲を分けている意味がなくなる
   */
  it("3-2 Groove とは3つ目の打点だけが違う", () => {
    const son = toPlaybackEvents(THREE_TWO_GROOVE).map((e) => e.tick);
    const rumba = toPlaybackEvents(THREE_TWO_GROOVE_2).map((e) => e.tick);

    expect(son).toEqual([0, 144, 288, 480, 576]);
    expect(rumba).toEqual([0, 144, 336, 480, 576]);

    const differing = son.map((t, i) => t !== rumba[i]);
    expect(differing).toEqual([false, false, true, false, false]);
  });

  it("1周期は 3-2 Groove と同じ 768 tick", () => {
    expect(totalTicks(THREE_TWO_GROOVE_2)).toBe(768);
  });

  it("高低の打ち分けはしない（すべて高）", () => {
    expect(toPlaybackEvents(THREE_TWO_GROOVE_2).every((e) => e.pitch === "high")).toBe(true);
  });

  it("BPM は2分音符で数える（カットタイム）", () => {
    expect(THREE_TWO_GROOVE_2.meter).toEqual({ beats: 2, beatUnit: 2, beatGroups: [1, 1] });
    expect(THREE_TWO_GROOVE_2.bpmUnit).toBe(192);
  });

  /** クラーベの 2 の側は、ソンでもルンバでも同じ形 */
  it("小節2は 3-2 Groove と同じ形", () => {
    const shape = (b: (typeof THREE_TWO_GROOVE.bars)[number]) =>
      b.items.map((i) => `${i.kind}:${i.duration}:${i.dots ?? 0}`);
    expect(shape(THREE_TWO_GROOVE_2.bars[1]!)).toEqual(shape(THREE_TWO_GROOVE.bars[1]!));
  });
});

describe("Afro Groove3", () => {
  /**
   * 口唱歌「ンカンカ ンカカン カンカカ ンカンカ」。
   * 16マス＝8分音符換算で、打点は 1 / 3 / 5 / 6 / 8 / 10 / 11 / 13 / 15。
   * 1マス 48 tick
   */
  it("打点が口唱歌のとおりに並ぶ", () => {
    expect(toPlaybackEvents(AFRO_GROOVE_3).map((e) => e.tick)).toEqual([
      48, 144, 240, 288, 384, 480, 528, 624, 720,
    ]);
  });

  /**
   * **収録で初めて、周期の頭が休符から始まるリズム。**
   * ハイライトの扱いがここだけ変わるので、性質としてテストで固定する
   */
  it("周期の頭は休符（最初の打点は tick 48）", () => {
    expect(toPlaybackEvents(AFRO_GROOVE_3)[0]!.tick).toBe(48);
  });

  it("1周期は 768 tick（2/2 × 2小節）", () => {
    expect(totalTicks(AFRO_GROOVE_3)).toBe(768);
  });

  it("高低の打ち分けはしない（すべて高）", () => {
    expect(toPlaybackEvents(AFRO_GROOVE_3).every((e) => e.pitch === "high")).toBe(true);
  });

  it("BPM は2分音符で数える（カットタイム）", () => {
    expect(AFRO_GROOVE_3.meter).toEqual({ beats: 2, beatUnit: 2, beatGroups: [1, 1] });
    expect(AFRO_GROOVE_3.bpmUnit).toBe(192);
  });

  /**
   * **音価が拍（2分音符＝192 tick）をまたがないこと。**
   * タイは v1 で使わないと決めているので、またぐ書き方をすると
   * 拍の頭が読めない譜面になる
   */
  it("どの音価も拍の境目をまたがない", () => {
    const beat = 192;
    AFRO_GROOVE_3.bars.forEach((bar) => {
      let at = 0;
      bar.items.forEach((item) => {
        const length = ticksOf(item);
        expect(Math.floor(at / beat)).toBe(Math.floor((at + length - 1) / beat));
        at += length;
      });
      expect(at).toBe(384);
    });
  });

  it("入れ替えの印は立てない（クラーベの形ではない）", () => {
    expect(AFRO_GROOVE_3.clave).toBeUndefined();
  });
});
