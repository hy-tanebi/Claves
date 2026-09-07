import { describe, expect, it } from "vitest";
import {
  eventAt,
  secondsAtTick,
  secondsPerTick,
  tickAtSeconds,
  type TransportPlan,
} from "./transport";

/** Son Clave 相当。2/2・bpmUnit 192・1周期 768 tick */
const plan = (over: Partial<TransportPlan> = {}): TransportPlan => ({
  schemaVersion: 1,
  ppq: 96,
  bpmUnit: 192,
  cycleTicks: 768,
  bpm: 120,
  originTick: 0,
  originSeconds: 0,
  events: [
    { tick: 0, pitch: "high" },
    { tick: 144, pitch: "high" },
    { tick: 288, pitch: "high" },
    { tick: 480, pitch: "high" },
    { tick: 576, pitch: "high" },
  ],
  ...over,
});

describe("secondsPerTick", () => {
  it("BPM の1拍を bpmUnit で割った長さになる", () => {
    // 120 BPM で2分音符が1拍 → 1拍 0.5 秒 → 1 tick = 0.5/192
    expect(secondsPerTick(plan())).toBeCloseTo(0.5 / 192, 12);
  });

  it("拍子が変われば同じ BPM でも tick の長さが変わる", () => {
    // 6/8 は付点4分が1拍（144 tick）
    expect(secondsPerTick(plan({ bpmUnit: 144 }))).toBeCloseTo(0.5 / 144, 12);
  });
});

describe("eventAt", () => {
  it("1周期目は events をそのまま返す", () => {
    const p = plan();
    expect(eventAt(p, 0)).toEqual({ absTick: 0, seconds: 0, pitch: "high" });
    expect(eventAt(p, 1).absTick).toBe(144);
    expect(eventAt(p, 1).seconds).toBeCloseTo(144 * (0.5 / 192), 12);
  });

  it("2周期目からは cycleTicks ぶん進む", () => {
    const p = plan();
    expect(eventAt(p, 5).absTick).toBe(768);
    expect(eventAt(p, 6).absTick).toBe(768 + 144);
    expect(eventAt(p, 5).seconds).toBeCloseTo(768 * (0.5 / 192), 12);
  });

  it("originTick と originSeconds を基準にずらせる", () => {
    // 拍境界 tick 192 から、その時刻 3.0 秒で始まる計画
    const p = plan({ originTick: 192, originSeconds: 3.0 });
    // 最初のイベント（周期内 tick 0）は原点より前にあるので負のずれになる
    expect(eventAt(p, 0).seconds).toBeCloseTo(3.0 + (0 - 192) * (0.5 / 192), 12);
    expect(eventAt(p, 0).absTick).toBe(0);
  });

  it("テンポを上げると時刻が縮む", () => {
    const slow = eventAt(plan({ bpm: 60 }), 1).seconds;
    const fast = eventAt(plan({ bpm: 240 }), 1).seconds;
    expect(fast).toBeCloseTo(slow / 4, 12);
  });

  it("何周しても打点の並びが崩れない", () => {
    const p = plan();
    const ticks = Array.from({ length: 20 }, (_, i) => eventAt(p, i).absTick);
    // 単調増加で、周期ごとに同じ形が繰り返される
    expect(ticks.every((t, i) => i === 0 || t > ticks[i - 1]!)).toBe(true);
    expect(ticks.slice(0, 5).map((t) => t + 768)).toEqual(ticks.slice(5, 10));
  });
});

describe("tick と時刻の相互変換", () => {
  it("基準点では時刻がそのまま", () => {
    const p = plan({ originTick: 192, originSeconds: 3 });
    expect(secondsAtTick(p, 192)).toBeCloseTo(3, 12);
    expect(tickAtSeconds(p, 3)).toBeCloseTo(192, 9);
  });

  it("往復しても値が戻る", () => {
    const p = plan({ originTick: 192, originSeconds: 3 });
    for (const tick of [0, 96, 192, 480, 1536]) {
      expect(tickAtSeconds(p, secondsAtTick(p, tick))).toBeCloseTo(tick, 9);
    }
  });

  it("eventAt の時刻は secondsAtTick と一致する", () => {
    const p = plan({ originTick: 192, originSeconds: 3 });
    for (let i = 0; i < 12; i++) {
      const e = eventAt(p, i);
      expect(e.seconds).toBeCloseTo(secondsAtTick(p, e.absTick), 12);
    }
  });
});
