import { MAX_BPM, MIN_BPM } from "./constants";

/**
 * 外から来た値をテンポとして受け取れる形に直す。受け取れないなら null。
 *
 * 「範囲外は clamp」と「不正入力は拒否」を分けているのが要点。
 * Number("") も Number(null) も Number(false) も 0 を返すため、
 * 「有限数か」だけで通すと、これらが静かに MIN_BPM へ化ける。
 * 数値と、数字を表す文字列だけを受け付ける。
 */
export function normalizeBpm(value: unknown): number | null {
  let n: number;

  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    if (value.trim() === "") return null;
    n = Number(value);
  } else {
    return null;
  }

  if (!Number.isFinite(n)) return null;
  return clampBpm(Math.round(n));
}

/** 整数のテンポを範囲内に収める */
export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}

/**
 * ±ボタンで1段階動かす。上限・下限では動かない。
 *
 * 戻り値が元の値と同じなら「もう動けない」。画面はこれでボタンを無効にし、
 * 長押しの繰り返しを止める
 */
export function stepBpm(bpm: number, delta: number): number {
  return clampBpm(bpm + delta);
}
