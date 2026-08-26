import { buildPlan } from "../domain/plan-builder";
import type { Pattern } from "../domain/types";

/**
 * Swift 側 `ClavesAudioPlugin` の呼び口。
 *
 * **計画は文字列で渡す。** Swift は `call.getString("planJson")` で読むので、
 * オブジェクトで送ると黙って弾かれて無音になる。
 * 文字列のままにしておくと `golden/plans.json` と同じ形が
 * そのままネイティブに届くので、検査した経路と実際の経路が一致する。
 */
export type ClavesAudioPlugin = {
  start(options: { planJson: string }): Promise<void>;
  stop(): Promise<void>;
  applyPlan(options: { planJson: string }): Promise<void>;
  setVolume(options: { value: number }): Promise<void>;
};

export type Origin = { originTick: number; originSeconds: number };

const FROM_START: Origin = { originTick: 0, originSeconds: 0 };

/**
 * プラグインを受け取る形にしてある。
 * Capacitor を読み込まずにテストできるようにするため。
 *
 * **ネイティブが弾いたエラーは握りつぶさない。**
 * 無音になった原因を追えなくなる。
 */
export function createNativeAudio(plugin: ClavesAudioPlugin) {
  return {
    async start(pattern: Pattern, bpm: number, origin: Origin = FROM_START): Promise<void> {
      await plugin.start({ planJson: JSON.stringify(buildPlan(pattern, bpm, origin)) });
    },

    async change(pattern: Pattern, bpm: number, origin: Origin = FROM_START): Promise<void> {
      await plugin.applyPlan({ planJson: JSON.stringify(buildPlan(pattern, bpm, origin)) });
    },

    async stop(): Promise<void> {
      await plugin.stop();
    },

    async setVolume(value: number): Promise<void> {
      await plugin.setVolume({ value });
    },
  };
}
