import { describe, expect, it } from "vitest";
import { MAX_BPM, MIN_BPM } from "./constants";
import { normalizeBpm, stepBpm } from "./bpm";

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

describe("stepBpm", () => {
  it("1段階ずつ上げ下げする", () => {
    expect(stepBpm(120, 1)).toBe(121);
    expect(stepBpm(120, -1)).toBe(119);
  });

  it("上限と下限を越えない", () => {
    expect(stepBpm(MAX_BPM, 1)).toBe(MAX_BPM);
    expect(stepBpm(MIN_BPM, -1)).toBe(MIN_BPM);
  });
});
