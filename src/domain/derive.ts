import { barTicks, ticksOf, tupletAt } from "./ticks";
import type { Pattern, PlaybackEvent } from "./types";

/**
 * 譜面データから再生イベントを導出する。
 *
 * 譜面が唯一の真実源であり、この向き（譜面 → 再生）でしか変換しない。
 * 逆向き（打点間隔から音価と休符を復元する）は原理的に一意に定まらない。
 * 8分休符を挟む4分音符、シンコペーション、拍をまたぐ表記では、
 * 次の打点までの距離が同じでも譜面上の書き方が複数あり得るため。
 */
export function toPlaybackEvents(p: Pattern): PlaybackEvent[] {
  const events: PlaybackEvent[] = [];
  const perBar = barTicks(p.meter);

  p.bars.forEach((bar, bi) => {
    let sum = 0;
    bar.items.forEach((item, i) => {
      if (item.kind === "note") {
        events.push({ noteId: item.id, tick: bi * perBar + sum, pitch: item.pitch });
      }
      sum += ticksOf(item, tupletAt(bar, i));
    });
  });

  return events.sort((a, b) => a.tick - b.tick);
}
