import { describe, expect, it } from "vitest";
import { toPlaybackEvents } from "./derive";
import { PATTERNS } from "./registry";
import { totalTicks } from "./ticks";
import { eventAt, secondsAtTick, type TransportPlan } from "./transport";
import type { Pattern } from "./types";

/**
 * **JS と Swift の答え合わせ表。**
 *
 * iOS ではバックグラウンドで WKWebView ごと止まるため、再生クロックは
 * ネイティブが所有する。tick から時刻を出す式を2言語で持つことになるので、
 * 同じ入力に同じ出力が返ることを、この表で両側から確かめる。
 *
 * 表を書き直すとき（式を意図して変えたとき）:
 *     pnpm gen:golden
 *
 * それ以外でこのテストが落ちたら、**式が意図せず変わった**ということ。
 */
const GOLDEN_PATH = "../../golden/transport.json";

/** 桁を揃える。言語をまたぐ比較では丸めた値を契約にする */
const round = (n: number): number => Number(n.toFixed(9));

function planOf(pattern: Pattern, bpm: number, originTick = 0, originSeconds = 0): TransportPlan {
  return {
    schemaVersion: 1,
    ppq: 96,
    bpmUnit: pattern.bpmUnit,
    cycleTicks: totalTicks(pattern),
    bpm,
    originTick,
    originSeconds,
    events: toPlaybackEvents(pattern).map((e) => ({ tick: e.tick, pitch: e.pitch })),
  };
}

const take = (plan: TransportPlan, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const e = eventAt(plan, i);
    return { absTick: e.absTick, seconds: round(e.seconds), pitch: e.pitch };
  });

function buildGolden() {
  const scenarios: unknown[] = [];

  // 1. 各リズムを3つのテンポで、2周期ぶん
  for (const pattern of PATTERNS) {
    for (const bpm of [40, 120, 240]) {
      const plan = planOf(pattern, bpm);
      scenarios.push({
        name: `${pattern.id} @ ${bpm}bpm`,
        kind: "steady",
        plan,
        expected: take(plan, toPlaybackEvents(pattern).length * 2),
      });
    }
  }

  // 2. 拍境界での切替。継ぎ目に穴も重なりも出ないことを示す
  const a = PATTERNS[0]!;
  const b = PATTERNS[PATTERNS.length - 1]!;
  const planA = planOf(a, 120);
  const atTick = a.bpmUnit * 2; // 2拍目の頭
  const atSeconds = secondsAtTick(planA, atTick);
  const planB = planOf(b, 180, 0, atSeconds);
  scenarios.push({
    name: `${a.id} → ${b.id} を tick ${atTick} で切り替える`,
    kind: "switch",
    applyAtTick: atTick,
    applyAtSeconds: round(atSeconds),
    before: { plan: planA, expected: take(planA, 8).filter((e) => e.absTick < atTick) },
    after: { plan: planB, expected: take(planB, 8) },
  });

  return {
    schemaVersion: 1,
    note: "JS と Swift の答え合わせ表。seconds は小数9桁に丸めた値を契約とする。",
    generatedBy: "pnpm gen:golden",
    scenarios,
  };
}

describe("golden fixture", () => {
  it("書き出した表と、いまの式の出力が一致する", async () => {
    // Vitest のファイルスナップショットを使う。fs も process も要らないので
    // このためだけに @types/node を足さずに済む
    await expect(`${JSON.stringify(buildGolden(), null, 2)}\n`).toMatchFileSnapshot(GOLDEN_PATH);
  });

  it("切替の継ぎ目に穴も重なりもない", () => {
    const g = buildGolden();
    const sw = g.scenarios.at(-1) as {
      applyAtTick: number;
      before: { expected: Array<{ seconds: number }> };
      after: { expected: Array<{ seconds: number }> };
      applyAtSeconds: number;
    };
    const lastBefore = sw.before.expected.at(-1)!;
    const firstAfter = sw.after.expected[0]!;
    // 切替前の最後の音は切替時刻より前、切替後の最初の音は切替時刻ちょうど
    expect(lastBefore.seconds).toBeLessThan(sw.applyAtSeconds);
    expect(firstAfter.seconds).toBeCloseTo(sw.applyAtSeconds, 9);
  });
});
