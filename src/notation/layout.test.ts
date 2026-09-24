import { describe, expect, it } from "vitest";
import { allocateWidths, LAYOUT } from "./layout";

describe("allocateWidths", () => {
  // このアプリはバリデータが全小節を同じ tick 長に強制している（validate.ts の tick sum 検査）。
  // 同じ長さの小節は、記譜の慣習では同じ幅にする。
  // 音符の数が違えば、小節の中での間隔が変わるだけ。
  it("必要量が違っても、小節の幅は等しくなる", () => {
    // 6/8 の実測値: 4分音符3つ+8分2つの小節(87) vs 8分休符+8分音符×3 の小節(125)
    expect(allocateWidths([87, 125], 526)).toEqual([263, 263]);
  });

  it("小節が1つなら全幅を使う", () => {
    expect(allocateWidths([87], 526)).toEqual([526]);
  });

  it("3小節でも等分する", () => {
    expect(allocateWidths([50, 90, 70], 300)).toEqual([100, 100, 100]);
  });

  // 等分では収まらないほど密な小節があるときだけ、配分を崩す
  it("等分に収まらない小節には必要量を与え、残りを他で分ける", () => {
    expect(allocateWidths([40, 160, 40], 300)).toEqual([70, 160, 70]);
  });

  it("必要量が大きい小節が複数あっても、残りは等分され直す", () => {
    // 等分 133.3 → 150 が確定 → 残り 250 を2つで 125 → 130 が確定 → 残り 120 が3つ目へ
    expect(allocateWidths([150, 130, 50], 400)).toEqual([150, 130, 120]);
  });

  it("必要量が収まる限り、配った幅の合計は与えた幅に一致する", () => {
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(allocateWidths([150, 130, 50], 400))).toBe(400);
    expect(sum(allocateWidths([87, 125], 526))).toBe(526);
    expect(sum(allocateWidths([50, 90, 70], 300))).toBe(300);
  });

  it("最小の音符領域を下回らない", () => {
    expect(allocateWidths([5, 280], 300)[0]).toBeGreaterThanOrEqual(LAYOUT.minNoteArea);
  });
});
