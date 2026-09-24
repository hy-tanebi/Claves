import { describe, expect, it } from "vitest";
import { bpmFromTaps, pushTap, TAP_RESET_MS, TAP_WINDOW } from "./tap-tempo";

/** 先頭 0ms から、与えた区間を順に足したタップ列を作る */
const taps = (...intervals: number[]): number[] =>
  intervals.reduce<number[]>((acc, ms) => [...acc, acc[acc.length - 1]! + ms], [0]);

describe("bpmFromTaps", () => {
  it("一定間隔なら素直に BPM を返す", () => {
    expect(bpmFromTaps(taps(500, 500, 500, 500))).toBe(120);
    expect(bpmFromTaps(taps(600, 600, 600, 600))).toBe(100);
  });

  it("タップが足りなければ null", () => {
    expect(bpmFromTaps([])).toBeNull();
    expect(bpmFromTaps([0])).toBeNull();
  });

  it("2タップ目から暫定値を出す", () => {
    expect(bpmFromTaps(taps(500))).toBe(120);
  });

  it("四捨五入する", () => {
    // 区間 550ms → 109.09 BPM
    expect(bpmFromTaps(taps(550, 550))).toBe(109);
  });

  it("タップを1回飛ばした区間（約2倍）を捨てる", () => {
    expect(bpmFromTaps(taps(500, 500, 1000))).toBe(120);
  });

  it("二重タップで割れた区間（約0.5倍）を捨てる", () => {
    expect(bpmFromTaps(taps(500, 500, 250, 250))).toBe(120);
  });

  // 外れ値の判定は「区間 ms の ±40%」ではなく「中央値との比」で行う。
  // ms に対する ±40% は BPM に直すと 0.71〜1.67 倍の非対称な窓になる。
  it("中央値の 1.4 倍ちょうどは残す", () => {
    // 区間 [500, 500, 500, 700]。中央値 500、700/500 = 1.4 → 残す
    // 平均 550ms → 109 BPM
    expect(bpmFromTaps(taps(500, 500, 500, 700))).toBe(109);
  });

  it("中央値の 1/1.4 倍を下回る区間は捨てる（ms の -40% なら残ってしまう）", () => {
    // 中央値 500 に対し 300 は 0.6 倍。1/1.4 = 0.714 を下回るので捨てる
    expect(bpmFromTaps(taps(500, 500, 500, 300))).toBe(120);
  });

  it("速すぎるタップは clamp せず捨てる", () => {
    // 区間 150ms → 400 BPM
    expect(bpmFromTaps(taps(150, 150, 150))).toBeNull();
  });

  it("遅すぎるタップは clamp せず捨てる", () => {
    // 区間 1800ms → 33 BPM
    expect(bpmFromTaps(taps(1800, 1800))).toBeNull();
  });

  it("下限 40・上限 240 ちょうどは受け付ける", () => {
    expect(bpmFromTaps(taps(1500, 1500))).toBe(40);
    expect(bpmFromTaps(taps(250, 250))).toBe(240);
  });
});

describe("pushTap", () => {
  it("最初のタップは列の先頭になる", () => {
    expect(pushTap([], 1000)).toEqual([1000]);
  });

  it("間隔が空いていなければ積む", () => {
    expect(pushTap([0, 500], 1000)).toEqual([0, 500, 1000]);
  });

  it(`直近から ${TAP_RESET_MS}ms 空いたら叩き直しとみなす`, () => {
    expect(pushTap([0, 500], 500 + TAP_RESET_MS)).toEqual([500 + TAP_RESET_MS]);
  });

  it(`${TAP_RESET_MS - 1}ms ならまだ同じ列`, () => {
    expect(pushTap([0, 500], 500 + TAP_RESET_MS - 1)).toEqual([0, 500, 500 + TAP_RESET_MS - 1]);
  });

  it(`直近 ${TAP_WINDOW} 件だけ残す`, () => {
    let t: number[] = [];
    for (let i = 0; i <= TAP_WINDOW; i++) t = pushTap(t, i * 500);
    expect(t).toEqual([500, 1000, 1500, 2000, 2500]);
  });

  it("時刻が逆行したタップは無視する", () => {
    expect(pushTap([0, 500], 400)).toEqual([0, 500]);
  });

  it("同じ時刻のタップは無視する", () => {
    expect(pushTap([0, 500], 500)).toEqual([0, 500]);
  });

  it("有限でない時刻は無視する", () => {
    expect(pushTap([0, 500], Number.NaN)).toEqual([0, 500]);
    expect(pushTap([0, 500], Number.POSITIVE_INFINITY)).toEqual([0, 500]);
  });
});
