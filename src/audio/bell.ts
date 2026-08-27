import type { Pitch } from "../domain/types";

/**
 * アゴゴ風の音の作り方。**JS と Swift が共有する契約。**
 *
 * ブラウザは Web Audio、iOS はネイティブが鳴らすので、
 * 音を作る式が2言語に存在してしまう。片方だけ変えて黙って音が変わるのを防ぐため、
 * `golden/click.json` に波形の抜き取りを書き出して Swift 側と突き合わせる。
 *
 * **高音と低音は同じ音色。** 基音だけを変える。
 * 別々の音色にすると、ひとつの楽器の高低ではなく別の楽器に聴こえてしまう。
 */
export const BELL_DURATION = 0.35;

/** 金属打楽器らしさは倍音が整数比から外れていることで出る */
export const BELL_PARTIALS = [
  { ratio: 1.0, gain: 1.0, decay: 12 },
  { ratio: 2.76, gain: 0.55, decay: 18 },
  { ratio: 5.4, gain: 0.3, decay: 26 },
  { ratio: 8.93, gain: 0.15, decay: 34 },
] as const;

/** 先頭のごく短いアタック整形（クリックノイズを避けつつ立ち上がりは保つ） */
export const BELL_ATTACK = 0.0015;
export const BELL_GAIN = 0.22;

/** アゴゴの高音・低音。**同じ音色で基音だけ変える** */
export const BELL_FUNDAMENTALS: Record<Pitch, number> = {
  high: 1180,
  low: 790,
};

/** 打点1つぶんの波形 */
export function bellSamples(fundamental: number, sampleRate: number): Float32Array {
  const length = Math.ceil(sampleRate * BELL_DURATION);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let v = 0;
    for (const p of BELL_PARTIALS) {
      v += Math.sin(2 * Math.PI * fundamental * p.ratio * t) * p.gain * Math.exp(-t * p.decay);
    }
    const attack = Math.min(1, t / BELL_ATTACK);
    data[i] = v * attack * BELL_GAIN;
  }

  return data;
}
