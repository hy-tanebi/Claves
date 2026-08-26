import { describe, expect, it } from "vitest";
import { buildPlan } from "./plan-builder";
import { PATTERNS } from "./registry";

const GOLDEN_PATH = "../../golden/plans.json";

/**
 * **JS が出す計画を Swift が受け取れるかの契約。**
 *
 * JS 側の出口は `buildPlan`、Swift 側の入口は `PlanDecoder`。
 * ここが食い違うと、実行時に無言で弾かれて音が鳴らない。
 *
 * 検証ルールを TS 側にも書き写すと二重管理になって必ずずれるので、
 * **実物の計画を書き出して Swift 側に読ませる**。
 * Swift のテスト（`PlansContractTests`）が同じファイルを
 * `PlanDecoder` に通して、全件が受理されることを確かめる。
 *
 * 書き直しは `pnpm gen:golden`。
 */
function buildPlans() {
  // 収録している全リズム × 実用範囲の端と中央
  const tempos = [40, 120, 240];

  return {
    schemaVersion: 1,
    note:
      "JS の buildPlan が出す計画。Swift の PlanDecoder が全件受理できることを両側から確かめる。",
    generatedBy: "pnpm gen:golden",
    plans: PATTERNS.flatMap((pattern) =>
      tempos.map((bpm) => ({
        name: `${pattern.id} @ ${bpm}bpm`,
        plan: buildPlan(pattern, bpm, { originTick: 0, originSeconds: 0 }),
      })),
    ),
  };
}

describe("ネイティブへ渡す計画の契約", () => {
  it("書き出した計画と、いまの buildPlan の出力が一致する", async () => {
    await expect(`${JSON.stringify(buildPlans(), null, 2)}\n`).toMatchFileSnapshot(GOLDEN_PATH);
  });

  it("収録している全リズム × 全テンポぶんある", () => {
    expect(buildPlans().plans).toHaveLength(PATTERNS.length * 3);
  });
});
