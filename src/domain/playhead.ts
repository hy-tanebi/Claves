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

  // **周期の頭に打点があるとは限らない。**
  // 3:2 を 2:3 に入れ替えると、休符から始まる周期になる。
  // 最初の打点より前は「前の周期の最後の打点」が鳴り続けている区間なので、
  // そこを初期値にする。
  //
  // ここを `events[0]` にすると、まだ鳴っていない次の音符を先に光らせ、
  // 実際に鳴った瞬間には id が変わらないので光らない
  // （2026-09-02 に反転で発覚）。
  let current = events[events.length - 1]!;
  for (const event of events) {
    if (event.tick > withinCycle) break;
    current = event;
  }
  return current.noteId;
}
