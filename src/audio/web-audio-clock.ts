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
  const duration = 0.35;
  const length = Math.ceil(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);

  // 非整数比の倍音を重ねて金属的な響きを作る
  const partials = [
    { ratio: 1.0, gain: 1.0, decay: 12 },
    { ratio: 2.76, gain: 0.55, decay: 18 },
    { ratio: 5.4, gain: 0.3, decay: 26 },
    { ratio: 8.93, gain: 0.15, decay: 34 },
  ];

  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    let v = 0;
    for (const p of partials) {
      v += Math.sin(2 * Math.PI * fundamental * p.ratio * t) * p.gain * Math.exp(-t * p.decay);
    }
    // 先頭 1.5ms のごく短いアタック整形（クリックノイズを避けつつ立ち上がりは保つ）
    const attack = Math.min(1, t / 0.0015);
    data[i] = v * attack * 0.22;
  }

  return buf;
}

/** アゴゴの高音・低音を合成する */
export function createBellBuffers(ctx: BaseAudioContext): Record<Pitch, AudioBuffer> {
  return {
    high: synthBell(ctx, 1180),
    low: synthBell(ctx, 790),
  };
}
