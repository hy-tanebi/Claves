import { describe, expect, it } from "vitest";
import { buildPlan } from "./plan-builder";
import { PATTERNS } from "./registry";
import { PPQ } from "./constants";

/**
 * 譜面データからネイティブへ渡す再生計画を組む。
 *
 * ここが JS 側の出口で、Swift 側の `PlanDecoder` が入口。
 * **形が食い違うと、実行時に無言で弾かれて音が鳴らない**ので、
 * 契約に関わる項目はテストで固定する。
 */
describe("buildPlan", () => {
  const threeTwo = PATTERNS.find((p) => p.id === "son-clave")!;

  it("契約に関わる項目を埋める", () => {
    const plan = buildPlan(threeTwo, 120, { originTick: 0, originSeconds: 0 });

    expect(plan.schemaVersion).toBe(1);
    expect(plan.ppq).toBe(PPQ);
    expect(plan.bpm).toBe(120);
    expect(plan.originTick).toBe(0);
    expect(plan.originSeconds).toBe(0);
  });

  it("bpmUnit はパターンから取る（拍子ごとに違うため）", () => {
    for (const pattern of PATTERNS) {
      const plan = buildPlan(pattern, 120, { originTick: 0, originSeconds: 0 });
      expect(plan.bpmUnit).toBe(pattern.bpmUnit);
    }
  });

  it("基準点をずらせる（切替のときに使う）", () => {
    const plan = buildPlan(threeTwo, 120, { originTick: 384, originSeconds: 2.5 });

    expect(plan.originTick).toBe(384);
    expect(plan.originSeconds).toBe(2.5);
  });

  it("打点は譜面から導き、昇順かつ周期の内側に収まる", () => {
    for (const pattern of PATTERNS) {
      const plan = buildPlan(pattern, 120, { originTick: 0, originSeconds: 0 });

      expect(plan.events.length).toBeGreaterThan(0);

      let previous = -1;
      for (const event of plan.events) {
        expect(event.tick).toBeGreaterThan(previous);
        expect(event.tick).toBeGreaterThanOrEqual(0);
        expect(event.tick).toBeLessThan(plan.cycleTicks);
        previous = event.tick;
      }
    }
  });

  it("周期長はパターン全体の長さ", () => {
    const plan = buildPlan(threeTwo, 120, { originTick: 0, originSeconds: 0 });

    // Son Clave は 2/4 が2小節。1小節 192 tick なので 384
    expect(plan.cycleTicks).toBe(384);
  });
});
