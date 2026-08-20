import { describe, expect, it } from "vitest";
import { MAX_BPM, MIN_BPM } from "./constants";
import { beatUnitLabel, normalizeBpm } from "./bpm";

describe("normalizeBpm", () => {
  it("範囲内の整数はそのまま通す", () => {
    expect(normalizeBpm(120)).toBe(120);
    expect(normalizeBpm(MIN_BPM)).toBe(MIN_BPM);
    expect(normalizeBpm(MAX_BPM)).toBe(MAX_BPM);
  });

  it("小数は四捨五入する", () => {
    expect(normalizeBpm(119.4)).toBe(119);
    expect(normalizeBpm(119.5)).toBe(120);
  });

  it("範囲外は clamp する", () => {
    expect(normalizeBpm(300)).toBe(MAX_BPM);
    expect(normalizeBpm(20)).toBe(MIN_BPM);
    expect(normalizeBpm(-5)).toBe(MIN_BPM);
  });

  it("数字を表す文字列を受け付ける", () => {
    expect(normalizeBpm("120")).toBe(120);
    expect(normalizeBpm(" 120 ")).toBe(120);
    expect(normalizeBpm("300")).toBe(MAX_BPM);
  });

  // Number("") も Number(null) も Number(false) も 0 になる。
  // 「有限数か」だけで通すと、これらが静かに MIN_BPM へ化ける。
  it("0 に化ける入力を拒否する（clamp しない）", () => {
    expect(normalizeBpm("")).toBeNull();
    expect(normalizeBpm("   ")).toBeNull();
    expect(normalizeBpm(null)).toBeNull();
    expect(normalizeBpm(false)).toBeNull();
    expect(normalizeBpm(true)).toBeNull();
    expect(normalizeBpm([])).toBeNull();
  });

  it("数値にならない入力を拒否する", () => {
    expect(normalizeBpm(undefined)).toBeNull();
    expect(normalizeBpm("abc")).toBeNull();
    expect(normalizeBpm("12x")).toBeNull();
    expect(normalizeBpm({})).toBeNull();
    expect(normalizeBpm([120])).toBeNull();
    expect(normalizeBpm(NaN)).toBeNull();
    expect(normalizeBpm(Infinity)).toBeNull();
    expect(normalizeBpm(-Infinity)).toBeNull();
  });
});

describe("beatUnitLabel", () => {
  it("BPM が何の音符で数えられているかを返す", () => {
    expect(beatUnitLabel(96)).toBe("4分音符");
    expect(beatUnitLabel(192)).toBe("2分音符");
    expect(beatUnitLabel(384)).toBe("全音符");
    expect(beatUnitLabel(48)).toBe("8分音符");
  });

  it("付点を見分ける", () => {
    expect(beatUnitLabel(144)).toBe("付点4分音符");
    expect(beatUnitLabel(288)).toBe("付点2分音符");
    expect(beatUnitLabel(72)).toBe("付点8分音符");
  });

  it("音価に対応しない tick は null", () => {
    expect(beatUnitLabel(100)).toBeNull();
    expect(beatUnitLabel(0)).toBeNull();
  });
});
