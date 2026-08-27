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
  start(options: { planJson: string; title: string }): Promise<void>;
  stop(): Promise<void>;
  applyPlan(options: { planJson: string }): Promise<void>;
  setVolume(options: { value: number }): Promise<void>;
  /**
   * いま鳴らしている位置。譜面のハイライトに使う。
   *
   * `tick` は**周期をまたいで増え続ける絶対 tick**で、
   * サンプル位置からの換算なので小数になる。
   */
  getSnapshot(): Promise<TransportSnapshot>;
  /**
   * ネイティブ都合の再生・停止を受け取る。
   *
   * 割り込みやイヤホン抜去、ロック画面の操作で状態が変わったとき、
   * **JS が知らないと画面のボタンが実際とずれる。**
   */
  addListener(
    event: PlaybackEvent,
    callback: () => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

export type PlaybackEvent = "playbackStopped" | "playbackStarted";

export type TransportSnapshot = { tick: number; isPlaying: boolean };

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
      await plugin.start({
        planJson: JSON.stringify(buildPlan(pattern, bpm, origin)),
        // ロック画面に何を鳴らしているか出すため
        title: pattern.name,
      });
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

    /**
     * 再生位置をネイティブに聞く。
     * **JS 側で別に数えると必ずずれる**（時計を持っているのはネイティブ）。
     */
    async snapshot(): Promise<TransportSnapshot> {
      return plugin.getSnapshot();
    },

    /** 割り込み・イヤホン抜去・ロック画面の停止で呼ばれる */
    async onPlaybackStopped(callback: () => void): Promise<void> {
      await plugin.addListener("playbackStopped", callback);
    },

    /** ロック画面の再生ボタンで鳴り出したときに呼ばれる */
    async onPlaybackStarted(callback: () => void): Promise<void> {
      await plugin.addListener("playbackStarted", callback);
    },
  };
}
