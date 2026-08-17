import { describe, expect, it } from "vitest";
import { barTicks, secPerTick, ticksOf, totalTicks } from "./ticks";
import type { Duration, Meter, NotationItem, Pattern } from "./types";

const note = (duration: Duration, dots?: 0 | 1): NotationItem => ({
  kind: "note",
  id: "x",
  duration,
  dots,
  pitch: "high",
});

const METER_4_4: Meter = { beats: 4, beatUnit: 4, beatGroups: [1, 1, 1, 1] };
const METER_6_8: Meter = { beats: 6, beatUnit: 8, beatGroups: [3, 3] };

describe("ticksOf", () => {
  it("基本の音価を tick に変換する", () => {
    expect(ticksOf(note("w"))).toBe(384);
    expect(ticksOf(note("h"))).toBe(192);
    expect(ticksOf(note("q"))).toBe(96);
    expect(ticksOf(note("8"))).toBe(48);
    expect(ticksOf(note("16"))).toBe(24);
    expect(ticksOf(note("32"))).toBe(12);
  });

  it("付点は 1.5 倍にする", () => {
    expect(ticksOf(note("q", 1))).toBe(144);
    expect(ticksOf(note("8", 1))).toBe(72);
  });

  it("3連符は 2/3 にする（96 PPQ なら整数になる）", () => {
    expect(ticksOf(note("8"), { from: 0, to: 2, num: 3, den: 2 })).toBe(32);
    expect(ticksOf(note("16"), { from: 0, to: 2, num: 3, den: 2 })).toBe(16);
  });
});

describe("barTicks", () => {
  it("4/4 の1小節は 384 tick", () => {
    expect(barTicks(METER_4_4)).toBe(384);
  });

  it("6/8 の1小節は 288 tick", () => {
    expect(barTicks(METER_6_8)).toBe(288);
  });
});

describe("totalTicks", () => {
  it("小節数を掛けた値になる", () => {
    const p = { meter: METER_4_4, bars: [{ items: [] }, { items: [] }] } as unknown as Pattern;
    expect(totalTicks(p)).toBe(768);
  });
});

describe("secPerTick", () => {
  it("4/4 の BPM120 では8分音符が 0.25 秒になる", () => {
    const p = { meter: METER_4_4, bpmUnit: 96 } as unknown as Pattern;
    expect(secPerTick(p, 120) * 48).toBeCloseTo(0.25, 10);
  });

  it("6/8 の BPM120 では付点4分が 0.5 秒になる（1拍 = 付点4分）", () => {
    const p = { meter: METER_6_8, bpmUnit: 144 } as unknown as Pattern;
    expect(secPerTick(p, 120) * 144).toBeCloseTo(0.5, 10);
  });
});
