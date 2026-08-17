import { BASE_TICKS, PPQ } from "./constants";
import type { Bar, Meter, NotationItem, Pattern, Tuplet } from "./types";

/** items の添字 index を含む連符グループを返す。なければ undefined */
export function tupletAt(bar: Bar, index: number): Tuplet | undefined {
  return bar.tuplets?.find((t) => index >= t.from && index <= t.to);
}

/** 1つの音符／休符の実長を tick で返す */
export function ticksOf(item: NotationItem, tuplet?: Tuplet): number {
  let t: number = BASE_TICKS[item.duration];
  if (item.dots === 1) t = (t * 3) / 2;
  if (tuplet) t = (t * tuplet.den) / tuplet.num;
  return t;
}

/** 1小節分の tick */
export function barTicks(meter: Meter): number {
  return meter.beats * ((PPQ * 4) / meter.beatUnit);
}

/** パターン全体（全小節）の tick */
export function totalTicks(p: Pattern): number {
  return p.bars.length * barTicks(p.meter);
}

/** 指定 BPM における 1 tick の秒数 */
export function secPerTick(p: Pattern, bpm: number): number {
  return 60 / bpm / p.bpmUnit;
}
