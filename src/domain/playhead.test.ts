import { describe, expect, it } from "vitest";
import { noteIdAtTick } from "./playhead";
import { canFlip, flipPattern } from "./flip";
import { toPlaybackEvents } from "./derive";
import { PATTERNS } from "./registry";
import { totalTicks } from "./ticks";

/**
 * 再生位置（絶対 tick）から、いま鳴っている音符を引く。
 *
 * ネイティブ再生ではクロックをネイティブが持つので、
 * JS は「いま何 tick か」しか受け取れない。
 * **そこから譜面のどこを光らせるかを決めるのがここ。**
 */
describe("noteIdAtTick", () => {
  const pattern = PATTERNS.find((p) => p.id === "three-two-groove")!;
  // 3-2 Groove の打点は 0 / 144 / 288 / 480 / 576（周期 768）

  it("打点ちょうどではその音符", () => {
    expect(noteIdAtTick(pattern, 0)).toBe("sr1");
    expect(noteIdAtTick(pattern, 144)).toBe("sr2");
  });

  it("打点の間では直前の音符が鳴り続けている", () => {
    expect(noteIdAtTick(pattern, 100)).toBe("sr1");
    expect(noteIdAtTick(pattern, 287)).toBe("sr2");
  });

  /// ネイティブから来る tick は周期をまたいで増え続ける
  it("周期をまたいでも同じ位置に戻る", () => {
    const cycle = totalTicks(pattern);

    expect(noteIdAtTick(pattern, cycle)).toBe(noteIdAtTick(pattern, 0));
    expect(noteIdAtTick(pattern, cycle * 3 + 144)).toBe(noteIdAtTick(pattern, 144));
  });

  /// 最後の打点より後ろは、周期の終わりまでその音符が続く
  it("最後の打点より後ろは最後の音符", () => {
    const cycle = totalTicks(pattern);
    expect(noteIdAtTick(pattern, cycle - 1)).toBe(noteIdAtTick(pattern, 576));
  });

  /// ネイティブは小数の tick を返す（サンプル位置からの換算なので）
  it("小数の tick でも引ける", () => {
    expect(noteIdAtTick(pattern, 144.7)).toBe("sr2");
  });

  /** 収録リズムはすべて周期の頭に打点があるので、null にはならない */
  it("収録している全リズムで必ず音符が引ける", () => {
    for (const p of PATTERNS) {
      const cycle = totalTicks(p);
      expect(toPlaybackEvents(p)[0]!.tick).toBe(0);
      for (let tick = 0; tick < cycle; tick += 7) {
        expect(noteIdAtTick(p, tick)).toBeTruthy();
      }
    }
  });
});

/**
 * **周期の頭に打点があるとは限らない。**
 * 3:2 を 2:3 に入れ替えると、休符から始まる周期になる。
 *
 * ここを間違えると、まだ鳴っていない次の音符を先に光らせ、
 * 実際に鳴った瞬間には id が変わらないので光らない。
 * 見た目には「ハイライトが早い」ではなく「タイミングが合わない」と出る。
 */
describe("周期の頭が休符のとき", () => {
  const flippable = PATTERNS.filter(canFlip);

  it("入れ替えられるリズムが少なくとも1つある", () => {
    expect(flippable.length).toBeGreaterThan(0);
  });

  /**
   * **再生を始めた直後は、まだ何も鳴っていない。**
   * ここで前の周期の最後の打点を返すと、始めた瞬間に2小節目の終わりが光る
   * （2026-09-02 オーナー報告）
   */
  it("1周目の最初の打点より前は、まだ鳴っていない（null）", () => {
    for (const p of flippable) {
      const flipped = flipPattern(p);
      const first = toPlaybackEvents(flipped)[0]!;

      // 反転すると先頭に休符ができる（できていなければこのテストの前提が崩れる）
      expect(first.tick).toBeGreaterThan(0);

      for (let tick = 0; tick < first.tick; tick += 1) {
        expect(noteIdAtTick(flipped, tick)).toBeNull();
      }
    }
  });

  /** 2周目以降の同じ区間は、前の周期の最後の打点が鳴り続けている */
  it("2周目以降の最初の打点より前は、前の周期の最後の打点", () => {
    for (const p of flippable) {
      const flipped = flipPattern(p);
      const events = toPlaybackEvents(flipped);
      const cycle = totalTicks(flipped);
      const first = events[0]!;
      const last = events[events.length - 1]!;

      for (let tick = cycle; tick < cycle + first.tick; tick += 1) {
        expect(noteIdAtTick(flipped, tick)).toBe(last.noteId);
      }
    }
  });

  it("最初の打点に達した瞬間に、その音符へ変わる", () => {
    for (const p of flippable) {
      const flipped = flipPattern(p);
      const first = toPlaybackEvents(flipped)[0]!;

      // 1周目：それまで null → 最初の打点で光る
      expect(noteIdAtTick(flipped, first.tick - 1)).toBeNull();
      expect(noteIdAtTick(flipped, first.tick)).toBe(first.noteId);
    }
  });

  /** 周期をまたいでも、打点の位置でだけ音符が変わること */
  it("音符が変わる位置は、打点の位置と1対1で対応する（2周目）", () => {
    for (const p of flippable) {
      const flipped = flipPattern(p);
      const cycle = totalTicks(flipped);
      const hitTicks = new Set(toPlaybackEvents(flipped).map((e) => e.tick));

      for (let tick = cycle + 1; tick < cycle * 2; tick += 1) {
        const changed = noteIdAtTick(flipped, tick) !== noteIdAtTick(flipped, tick - 1);
        expect(changed).toBe(hitTicks.has(tick - cycle));
      }
    }
  });
});
