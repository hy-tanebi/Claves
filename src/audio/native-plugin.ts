import { Capacitor, registerPlugin } from "@capacitor/core";
import { createNativeAudio, type ClavesAudioPlugin } from "./native-audio";

/**
 * ネイティブ再生エンジンへの接続。
 *
 * **Capacitor の読み込みをこのファイルだけに閉じ込める。**
 * `native-audio.ts` 側はプラグインを引数で受け取る形にしてあるので、
 * テストは Capacitor なしで書ける。
 *
 * iOS 実機・シミュレータでは `nativeAudio` が使え、
 * ブラウザでは `null` になって従来の Web Audio が動く。
 */
export const isNativePlatform = Capacitor.isNativePlatform();

export const nativeAudio = isNativePlatform
  ? createNativeAudio(registerPlugin<ClavesAudioPlugin>("ClavesAudio"))
  : null;
