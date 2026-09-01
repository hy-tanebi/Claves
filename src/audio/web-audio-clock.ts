import { clickSamples, DEFAULT_TIMBRE, TIMBRES, type Timbre } from "./bell";
import type { Pitch } from "../domain/types";
import type { AudioClock, ScheduleRequest, ScheduledSound } from "./clock";

/**
 * 実際の Web Audio API を使う時計。
 *
 * 予約は AudioBufferSourceNode.start(when) に絶対時刻を渡す。
 * 実際の発音はオーディオスレッドの高精度クロックが行うため、
 * メインスレッドが多少もたついても拍の間隔はヨレない。
 */
export class WebAudioClock implements AudioClock {
  private readonly gain: GainNode;

  /** いま鳴らす音色。**波形は音色ごとに作り置きしてある**ので切替は選び直すだけ */
  private timbre: Timbre = DEFAULT_TIMBRE;

  constructor(
    private readonly ctx: AudioContext,
    private readonly buffers: Record<Timbre, Record<Pitch, AudioBuffer>>,
  ) {
    this.gain = ctx.createGain();
    this.gain.connect(ctx.destination);
  }

  /**
   * 音色を変える。
   *
   * **すでに予約済みの打点はそのまま鳴る。** 予約を取り消して鳴らし直すと
   * 打点の位置がずれるため、切り替わるのは次に予約するぶんから。
   */
  setTimbre(timbre: Timbre): void {
    this.timbre = timbre;
  }

  now(): number {
    return this.ctx.currentTime;
  }

  /** 音量を変える。直接代入するとクリックノイズが出るので 20ms かけてランプさせる */
  setVolume(value: number): void {
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(value, t + 0.02);
  }

  schedule(req: ScheduleRequest): ScheduledSound {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[this.timbre][req.pitch];
    src.connect(this.gain);
    src.start(req.time);

    let stopped = false;
    return {
      time: req.time,
      cancel() {
        if (stopped) return;
        stopped = true;
        try {
          src.stop();
        } catch {
          // すでに再生を終えている場合は何も起きない
        }
      },
    };
  }
}

/**
 * 打点の音を合成する（録音はしないと決めているので、合成が本番）。
 *
 * 楽器の違いは倍音の並びと減衰の速さで出す。式は `bell.ts` にあり、
 * Swift 側と `golden/click.json` で突き合わせている。
 */
export function synthClick(
  ctx: BaseAudioContext,
  timbre: Timbre,
  pitch: Pitch,
): AudioBuffer {
  const data = clickSamples(timbre, pitch, ctx.sampleRate);
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.getChannelData(0).set(data);
  return buf;
}

/**
 * **全音色ぶんを起動時に作る。**
 *
 * 切り替えのたびに合成すると、その場で数万サンプルぶんの三角関数を回すことになり、
 * 押した瞬間に音が途切れる。音色は2種類しかないので先に作っておく。
 */
export function createClickBuffers(
  ctx: BaseAudioContext,
): Record<Timbre, Record<Pitch, AudioBuffer>> {
  const out = {} as Record<Timbre, Record<Pitch, AudioBuffer>>;
  for (const timbre of TIMBRES) {
    out[timbre] = {
      high: synthClick(ctx, timbre, "high"),
      low: synthClick(ctx, timbre, "low"),
    };
  }
  return out;
}
