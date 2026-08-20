import { BASE_TICKS, MAX_BPM, MIN_BPM } from "./constants";

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

const DURATION_NAMES: Record<keyof typeof BASE_TICKS, string> = {
  w: "全音符",
  h: "2分音符",
  q: "4分音符",
  "8": "8分音符",
  "16": "16分音符",
  "32": "32分音符",
};

/**
 * BPM が何の音符で数えられているかを日本語で返す。対応しない tick なら null。
 *
 * 画面に必ず出す。同じ「120 BPM」でも 2分音符と4分音符では速さが倍違い、
 * 数字だけでは何を叩けばいいのか読み取れない。
 *
 * Unicode の音符記号（U+1D15E など）は使わない。iOS の既定フォントに
 * 収録がなく、豆腐になる端末がある。
 */
export function beatUnitLabel(bpmUnit: number): string | null {
  for (const [duration, ticks] of Object.entries(BASE_TICKS)) {
    const name = DURATION_NAMES[duration as keyof typeof BASE_TICKS];
    if (bpmUnit === ticks) return name;
    if (bpmUnit === ticks * 1.5) return `付点${name}`;
  }
  return null;
}
