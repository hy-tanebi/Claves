import { BELL_FUNDAMENTALS, bellSamples } from "./bell";
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

  constructor(
    private readonly ctx: AudioContext,
    private readonly buffers: Record<Pitch, AudioBuffer>,
  ) {
    this.gain = ctx.createGain();
    this.gain.connect(ctx.destination);
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
    src.buffer = this.buffers[req.pitch];
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
 * アゴゴ風の音を合成する（本番の録音音源に差し替えるまでの仮）。
 *
 * 金属打楽器らしさは倍音が整数比から外れていることで出る。
 * 立ち上がりを鋭くしてアタックを明確にし、タイミングが取りやすいようにする。
 */
export function synthBell(ctx: BaseAudioContext, fundamental: number): AudioBuffer {
  const data = bellSamples(fundamental, ctx.sampleRate);
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.getChannelData(0).set(data);
  return buf;
}

/** アゴゴの高音・低音を合成する */
export function createBellBuffers(ctx: BaseAudioContext): Record<Pitch, AudioBuffer> {
  return {
    high: synthBell(ctx, BELL_FUNDAMENTALS.high),
    low: synthBell(ctx, BELL_FUNDAMENTALS.low),
  };
}
