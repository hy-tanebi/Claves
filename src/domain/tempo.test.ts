import { describe, expect, it } from "vitest";
import { THREE_TWO_GROOVE } from "./patterns/three-two-groove";
import { secPerTick, totalTicks } from "./ticks";
import { toPlaybackEvents } from "./derive";

/** 指定 BPM での1周期の秒数 */
const cycleSeconds = (bpm: number) => totalTicks(THREE_TWO_GROOVE) * secPerTick(THREE_TWO_GROOVE, bpm);

describe("3-2 Groove のテンポ", () => {
  it("2/2 なので BPM は2分音符で数える（カットタイム）", () => {
    // 4分音符で数えると倍遅くなる。見本の the Clave も "in cut time"
    expect(THREE_TWO_GROOVE.bpmUnit).toBe(192);
  });

  it("BPM 100 で1周期 2.4 秒", () => {
    expect(cycleSeconds(100)).toBeCloseTo(2.4, 6);
  });

  it("BPM 120 で1周期 2.0 秒", () => {
    expect(cycleSeconds(120)).toBeCloseTo(2.0, 6);
  });

  it("1小節は1周期の半分", () => {
    expect(cycleSeconds(120) / THREE_TWO_GROOVE.bars.length).toBeCloseTo(1.0, 6);
  });

  it("BPM 100 での打点の間隔が計算どおり", () => {
    const spt = secPerTick(THREE_TWO_GROOVE, 100);
    const times = toPlaybackEvents(THREE_TWO_GROOVE).map((e) => +(e.tick * spt).toFixed(3));
    expect(times).toEqual([0, 0.45, 0.9, 1.5, 1.8]);
  });
});
