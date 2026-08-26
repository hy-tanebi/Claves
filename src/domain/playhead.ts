import { toPlaybackEvents } from "./derive";
import { totalTicks } from "./ticks";
import type { Pattern } from "./types";

/**
 * 再生位置（絶対 tick）から、いま鳴っている音符を引く。
 *
 * ネイティブ再生ではクロックをネイティブが持つので、
 * JS は「いま何 tick か」しか受け取れない。
 * **そこから譜面のどこを光らせるかを決めるのがここ。**
 *
 * ネイティブから来る tick は
 * - 周期をまたいで増え続ける（先頭に戻らない）
 * - サンプル位置からの換算なので小数になる
 *
 * ので、どちらも受け取れるようにしてある。
 */
export function noteIdAtTick(pattern: Pattern, tick: number): string {
  const events = toPlaybackEvents(pattern);
  const cycle = totalTicks(pattern);

  // 周期の中へ畳む。負の値でも先頭側に回り込ませる
  const withinCycle = ((tick % cycle) + cycle) % cycle;

  // その時点で最後に鳴った打点。打点の間はその音符が鳴り続けている
  let current = events[0]!;
  for (const event of events) {
    if (event.tick > withinCycle) break;
    current = event;
  }
  return current.noteId;
}
