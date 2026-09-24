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
export function noteIdAtTick(pattern: Pattern, tick: number): string | null {
  const events = toPlaybackEvents(pattern);
  const cycle = totalTicks(pattern);

  // **まだ1つも鳴っていない区間は null を返す。**
  //
  // ネイティブは再生開始と切替でこの計画の tick 0 に合わせ直すので、
  // 「最初の打点より前の絶対 tick」は **この計画がまだ鳴っていない**ことを意味する。
  // 畳んでしまうとこの区別が消える。
  //
  // ここで前の周期の最後の打点を返すと、2:3（周期の頭が休符）で
  // **始めた瞬間に2小節目の終わりが光る**（2026-09-02 に発覚）。
  // 周期の頭に打点があるリズムでは `events[0].tick` が 0 なので、
  // この分岐には入らない。
  if (tick < events[0]!.tick) return null;

  // 周期の中へ畳む
  const withinCycle = ((tick % cycle) + cycle) % cycle;

  // **周期の頭に打点があるとは限らない。**
  // 3:2 を 2:3 に入れ替えると、休符から始まる周期になる。
  // 2周目以降のその区間は「前の周期の最後の打点」が鳴り続けているので、
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
