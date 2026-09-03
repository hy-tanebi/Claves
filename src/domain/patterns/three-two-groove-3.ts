import type { Pattern } from "../types";

/**
 * 3-2 Groove3。**サンバヘギの骨格タイムライン。**
 *
 * 口唱歌で数えると:
 *
 *   カンンカ ンンカン ンンカン ンカンン
 *   ●・・●  ・・●・  ・・●・  ・●・・
 *
 * 8分音符換算で 0 / 3 / 6 / 10 / 13。
 * 絶対 tick は 0 / 144 / 288 / 480 / 624、1周期 768 tick。
 *
 * **ソンクラーベでもルンバクラーベでもない。**
 * 5つ目の打点が 13 にある（ソンもルンバも 12）。
 * 前半3打・後半2打の 3-2 型なので入れ替えは成り立つが、
 * **「〜クラーベと同一」とは書かない**（そう書けば、アプリが
 * 根拠のないことを主張することになる）。
 *
 * 収録済みの3曲との関係:
 *
 *   3-2 Groove   0 / 3 / 6 / 10 / 12   ソンクラーベ 3-2
 *   3-2 Groove2  0 / 3 / 7 / 10 / 12   ルンバクラーベ 3-2
 *   3-2 Groove3  0 / 3 / 6 / 10 / 13   ← これ
 *
 * **小節1は 3-2 Groove と同じ形**（0 / 3 / 6）。違うのは後半だけ。
 *
 * 記譜はサンバ系の正式である **2/2（アラブレーヴェ）× 2小節**。
 *
 *   小節1: ♩. ♪ | 𝄽 ♩      = (144+48) + (96+96) = 384
 *   小節2: 𝄽 ♩  | 𝄾 ♩ 𝄾    = (96+96) + (48+96+48) = 384
 *
 * **音価が拍（2分音符＝192 tick）をまたがないように区切っている。**
 * タイは v1 で使わないと決めているため。休符は付点にしない。
 *
 * BPM は2分音符で数える（カットタイム）。BPM 100 で1周期 2.4 秒。
 *
 * 高低の打ち分けはしない。3:2 ⇄ 2:3 の入れ替えができる（`clave`）。
 */
export const THREE_TWO_GROOVE_3: Pattern = {
  id: "three-two-groove-3",
  name: "3-2 Groove3",
  meter: { beats: 2, beatUnit: 2, beatGroups: [1, 1] },
  bpmUnit: 192,
  // 前半3打・後半2打の 3-2 型であることは本人が確認済み（source 参照）。
  // この印がある間だけ 3:2 ⇄ 2:3 の入れ替えができる
  clave: "3-2",
  bars: [
    {
      items: [
        { kind: "note", id: "tg1", duration: "q", dots: 1, pitch: "high" },
        { kind: "note", id: "tg2", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q" },
        { kind: "note", id: "tg3", duration: "q", pitch: "high" },
      ],
    },
    {
      items: [
        { kind: "rest", duration: "q" },
        { kind: "note", id: "tg4", duration: "q", pitch: "high" },
        { kind: "rest", duration: "8" },
        { kind: "note", id: "tg5", duration: "q", pitch: "high" },
        { kind: "rest", duration: "8" },
      ],
    },
  ],
  source: {
    locator: {
      type: "primary",
      person: "菅原隼人",
      role: "BOAVISTA 主宰・奏者",
    },
    transcribedBy: "菅原隼人",
    confirmedOn: "2026-09-03",
    arrangementNotes:
      "口唱歌「カンンカ ンンカン ンンカン ンカンン」を本人が確認。" +
      "前半3打・後半2打のクラーベ型だが、ソンともルンバとも並びが違う" +
      "（5つ目の打点が 13）。3-2 の形で収録し、2-3 は入れ替えで導く。" +
      "記譜は 2/2（アラブレーヴェ）。音価が拍をまたがないよう区切り、休符は付点にしない。",
  },
};
