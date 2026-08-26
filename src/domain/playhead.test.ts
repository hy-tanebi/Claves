import { describe, expect, it } from "vitest";
import { noteIdAtTick } from "./playhead";
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

  it("収録している全リズムで必ず音符が引ける", () => {
    for (const p of PATTERNS) {
      const cycle = totalTicks(p);
      for (let tick = 0; tick < cycle; tick += 7) {
        expect(noteIdAtTick(p, tick)).toBeTruthy();
      }
    }
  });
});
