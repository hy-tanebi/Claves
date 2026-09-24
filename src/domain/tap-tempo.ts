import { MAX_BPM, MIN_BPM } from "./constants";

/**
 * 直近から何 ms 空いたら「叩き直し」とみなすか。
 *
 * 最も遅い正当なタップ間隔は 60000 / MIN_BPM = 1500ms。
 * それより明確に長い間隔を、列の打ち切りとして扱う。
 * ちょうど TAP_RESET_MS はリセット側に倒す。
 */
export const TAP_RESET_MS = 2000;

/** 使うタップの本数。5タップ＝4区間。反応の速さと安定のつり合いがこのあたり */
export const TAP_WINDOW = 5;

/**
 * 外れ値の許容比。中央値との比がこの範囲（1/1.4 〜 1.4）を外れた区間を捨てる。
 *
 * 「区間 ms の ±40%」ではなく比で判定するのが要点。
 * ms に対する ±40% は BPM に直すと 0.71〜1.67 倍の非対称な窓になり、
 * 「速くなった」と「遅くなった」で許容量が変わってしまう。
 * この窓でも、タップ抜け（約2倍）と二重タップ（約0.5倍）はどちらも落ちる。
 */
export const OUTLIER_RATIO = 1.4;

/**
 * タップ列に1打を足す。列そのものは呼び出し側が持つ。
 *
 * 逆行・同時刻・非有限の時刻は無視する（pointerdown と keydown が
 * 同じ操作で二重に飛ぶ場合があるため、ここで吸収する）。
 */
export function pushTap(taps: number[], timeMs: number): number[] {
  if (!Number.isFinite(timeMs)) return taps;

  const last = taps[taps.length - 1];
  if (last === undefined) return [timeMs];

  const gap = timeMs - last;
  if (gap <= 0) return taps;
  if (gap >= TAP_RESET_MS) return [timeMs];

  return [...taps, timeMs].slice(-TAP_WINDOW);
}

/**
 * タップ列からテンポを求める。求められないときは null。
 *
 * 範囲外（MIN_BPM 未満・MAX_BPM 超）は clamp せずに捨てる。
 * 240 を超える値が出るのは「上限まで速くしたい」ではなく
 * 「叩き方が乱れた」なので、前の値を保つほうが正しい。
 */
export function bpmFromTaps(taps: number[]): number | null {
  const recent = taps.slice(-TAP_WINDOW);
  if (recent.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < recent.length; i++) intervals.push(recent[i]! - recent[i - 1]!);

  const mid = median(intervals);
  if (mid <= 0) return null;

  const kept = intervals.filter((ms) => {
    const ratio = ms / mid;
    return ratio >= 1 / OUTLIER_RATIO && ratio <= OUTLIER_RATIO;
  });
  if (kept.length === 0) return null;

  const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
  const bpm = Math.round(60000 / mean);
  if (bpm < MIN_BPM || bpm > MAX_BPM) return null;
  return bpm;
}

/** 偶数個なら中央2つの平均 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[half]! : (sorted[half - 1]! + sorted[half]!) / 2;
}
