import type { Pitch } from "../domain/types";

/**
 * 打点の音の作り方。**JS と Swift が共有する契約。**
 *
 * ブラウザは Web Audio、iOS はネイティブが鳴らすので、
 * 音を作る式が2言語に存在してしまう。片方だけ変えて黙って音が変わるのを防ぐため、
 * `golden/click.json` に波形の抜き取りを書き出して Swift 側と突き合わせる。
 *
 * **高音と低音は同じ音色。** 基音だけを変える。
 * 別々の音色にすると、ひとつの楽器の高低ではなく別の楽器に聴こえてしまう。
 *
 * **音色は録音ではなく合成で作る**（2026-08-22 に録音しないと決定済み）。
 * 楽器の違いは倍音の並びと減衰の速さで出す。
 */

/** 収録している音色。**増やすときは Swift 側の `Timbre` も同時に足す** */
export type Timbre = "agogo" | "claves";

export const TIMBRES: readonly Timbre[] = ["agogo", "claves"] as const;
export const DEFAULT_TIMBRE: Timbre = "agogo";

/** 画面に出す名前 */
export const TIMBRE_LABELS: Record<Timbre, string> = {
  agogo: "アゴゴ",
  claves: "クラベス",
};

export type Partial = { ratio: number; gain: number; decay: number };

export type TimbreSpec = {
  /** 1打点の長さ（秒） */
  duration: number;
  /** 先頭のごく短いアタック整形（クリックノイズを避けつつ立ち上がりは保つ） */
  attack: number;
  gain: number;
  partials: readonly Partial[];
  /** 高音・低音の基音。**同じ音色で基音だけ変える** */
  fundamentals: Record<Pitch, number>;
};

export const TIMBRE_SPECS: Record<Timbre, TimbreSpec> = {
  /**
   * アゴゴ（金属）。**金属打楽器らしさは倍音が整数比から外れていることで出る。**
   * 減衰が遅く、打ったあとに余韻が残る。
   */
  agogo: {
    duration: 0.35,
    attack: 0.0015,
    gain: 0.22,
    partials: [
      { ratio: 1.0, gain: 1.0, decay: 12 },
      { ratio: 2.76, gain: 0.55, decay: 18 },
      { ratio: 5.4, gain: 0.3, decay: 26 },
      { ratio: 8.93, gain: 0.15, decay: 34 },
    ],
    fundamentals: { high: 1180, low: 790 },
  },

  /**
   * クラベス（木）。**金属との違いは余韻の短さで出る。**
   * 減衰をアゴゴの4〜5倍速くし、鳴り終わりまでを 0.12 秒に切る。
   * 倍音は金属ほど散らさない（木は響きが単純で、基音がはっきり聴こえる）。
   * 短いぶん音圧が下がるので、全体の音量をやや上げて他の音色と揃える。
   */
  claves: {
    duration: 0.12,
    attack: 0.0006,
    gain: 0.3,
    partials: [
      { ratio: 1.0, gain: 1.0, decay: 55 },
      { ratio: 1.62, gain: 0.45, decay: 75 },
      { ratio: 2.95, gain: 0.22, decay: 95 },
      { ratio: 4.6, gain: 0.1, decay: 120 },
    ],
    fundamentals: { high: 2400, low: 1750 },
  },
};

/** 打点1つぶんの波形 */
export function clickSamples(
  timbre: Timbre,
  pitch: Pitch,
  sampleRate: number,
): Float32Array {
  const spec = TIMBRE_SPECS[timbre];
  const fundamental = spec.fundamentals[pitch];
  const length = Math.ceil(sampleRate * spec.duration);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let v = 0;
    for (const p of spec.partials) {
      v += Math.sin(2 * Math.PI * fundamental * p.ratio * t) * p.gain * Math.exp(-t * p.decay);
    }
    const attack = Math.min(1, t / spec.attack);
    data[i] = v * attack * spec.gain;
  }

  return data;
}

/** 端末に残っていた値をそのまま信用しない。知らない音色なら既定に落とす */
export function pickTimbre(value: string | null): Timbre {
  return TIMBRES.includes(value as Timbre) ? (value as Timbre) : DEFAULT_TIMBRE;
}
