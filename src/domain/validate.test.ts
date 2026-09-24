import { describe, expect, it } from "vitest";
import { FIXTURE_2_4, FIXTURE_4_4, FIXTURE_6_8 } from "./fixtures";
import { validatePattern } from "./validate";
import type { Pattern } from "./types";

const clone = (p: Pattern): Pattern => structuredClone(p);

describe("validatePattern", () => {
  it("妥当なパターンはエラーを返さない", () => {
    expect(validatePattern(FIXTURE_2_4)).toEqual([]);
    expect(validatePattern(FIXTURE_4_4)).toEqual([]);
    expect(validatePattern(FIXTURE_6_8)).toEqual([]);
  });

  it("2/4 の bpmUnit は 96", () => {
    const p = clone(FIXTURE_2_4);
    p.bpmUnit = 144;
    expect(validatePattern(p).join()).toContain("bpmUnit must be 96");
  });

  it("小節の tick 合計が合わないと拒否する", () => {
    const p = clone(FIXTURE_4_4);
    p.bars[0]!.items.push({ kind: "rest", duration: "8" });
    expect(validatePattern(p).join()).toContain("tick sum");
  });

  it("小節の tick 合計が超過していたら拒否する", () => {
    const p = clone(FIXTURE_4_4);
    p.bars.push({
      items: [
        { kind: "note", id: "z1", duration: "w", pitch: "high" },
        { kind: "note", id: "z2", duration: "w", pitch: "low" },
      ],
    });
    expect(validatePattern(p).join()).toContain("tick sum");
  });

  it("2/4・4/4・6/8 以外の拍子を拒否する", () => {
    const p = clone(FIXTURE_4_4);
    p.meter = { beats: 3, beatUnit: 4, beatGroups: [1, 1, 1] };
    expect(validatePattern(p).join()).toContain("is not allowed");
  });

  it("拍子に合わない bpmUnit を拒否する", () => {
    const p = clone(FIXTURE_4_4);
    p.bpmUnit = 144;
    expect(validatePattern(p).join()).toContain("bpmUnit must be 96");
  });

  it("beatGroups の合計が beats と違うと拒否する", () => {
    const p = clone(FIXTURE_4_4);
    p.meter.beatGroups = [1, 1, 1];
    expect(validatePattern(p).join()).toContain("sum(beatGroups)");
  });

  it("beatGroups に 0 や負数が入ると拒否する", () => {
    const p = clone(FIXTURE_4_4);
    p.meter.beatGroups = [0, 4];
    expect(validatePattern(p).join()).toContain("positive integers");
  });

  it("note の id が重複すると拒否する", () => {
    const p = clone(FIXTURE_4_4);
    (p.bars[1]!.items[1] as { id: string }).id = "a1";
    expect(validatePattern(p).join()).toContain("duplicate note id");
  });

  it("音符が1つもないと拒否する", () => {
    const p = clone(FIXTURE_4_4);
    p.bars = [{ items: [{ kind: "rest", duration: "w" }] }];
    expect(validatePattern(p).join()).toContain("at least one note");
  });

  it("bars が空だと拒否する", () => {
    const p = clone(FIXTURE_4_4);
    p.bars = [];
    expect(validatePattern(p).join()).toContain("at least one bar");
  });

  it("tie が混入していたら拒否する", () => {
    const p = clone(FIXTURE_4_4);
    (p.bars[0]!.items[0] as Record<string, unknown>).tie = true;
    expect(validatePattern(p).join()).toContain("tie is not supported");
  });

  it("beams に休符が含まれていたら拒否する", () => {
    const p = clone(FIXTURE_4_4);
    p.bars[0]!.beams = [[0, 1]]; // index 1 は4分休符
    expect(validatePattern(p).join()).toContain("non-beamable");
  });

  it("beams 同士が重なっていたら拒否する", () => {
    const p = clone(FIXTURE_6_8);
    p.bars[0]!.beams = [
      [0, 1],
      [1, 2],
    ];
    expect(validatePattern(p).join()).toContain("beams: ranges overlap");
  });

  it("beams と tuplets の範囲が重なるのは許容する", () => {
    const p = clone(FIXTURE_6_8);
    p.bars[0]!.beams = [[0, 2]];
    p.bars[0]!.tuplets = [{ from: 0, to: 2, num: 3, den: 3 }]; // 長さを変えない連符
    expect(validatePattern(p)).toEqual([]);
  });

  it("連符グループの tick が整数でないと拒否する", () => {
    const p = clone(FIXTURE_6_8);
    // 8分 x3 を 5:2 の連符にすると 48*2/5 = 19.2 で整数にならない
    p.bars[0]!.tuplets = [{ from: 0, to: 2, num: 5, den: 2 }];
    expect(validatePattern(p).join()).toContain("not an integer");
  });

  it("範囲が items の外に出ていたら拒否する", () => {
    const p = clone(FIXTURE_6_8);
    p.bars[0]!.beams = [[0, 99]];
    expect(validatePattern(p).join()).toContain("out of bounds");
  });

  it("source の必須項目が欠けていたら拒否する", () => {
    const p = clone(FIXTURE_4_4);
    (p.source as Record<string, unknown>).transcribedBy = "";
    expect(validatePattern(p).join()).toContain("source.transcribedBy");
  });
});
