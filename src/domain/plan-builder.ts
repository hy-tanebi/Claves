import { PPQ } from "./constants";
import { toPlaybackEvents } from "./derive";
import { totalTicks } from "./ticks";
import type { TransportPlan } from "./transport";
import type { Pattern } from "./types";

/**
 * 譜面データからネイティブへ渡す再生計画を組む。
 *
 * **ここが JS 側の出口で、Swift 側の `PlanDecoder` が入口。**
 * 形が食い違うと実行時に無言で弾かれて音が鳴らないので、
 * 収録している全リズムがネイティブの検証を通ることを
 * `golden/plans.json` 経由で両側から確かめる。
 *
 * 譜面が唯一の真実源なので、打点は必ず `toPlaybackEvents` から導く。
 */
export function buildPlan(
  pattern: Pattern,
  bpm: number,
  origin: { originTick: number; originSeconds: number },
): TransportPlan {
  return {
    schemaVersion: 1,
    ppq: PPQ,
    bpmUnit: pattern.bpmUnit,
    cycleTicks: totalTicks(pattern),
    bpm,
    originTick: origin.originTick,
    originSeconds: origin.originSeconds,
    events: toPlaybackEvents(pattern).map((e) => ({ tick: e.tick, pitch: e.pitch })),
  };
}
