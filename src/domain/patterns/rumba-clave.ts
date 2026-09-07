import type { Pattern } from "../types";

/**
 * Rumba Clave。**サンバヘギの骨格タイムライン。**
 *
 * 表示名は打点の形（クラーベ 3-2）から取っている。
 * 由来がサンバヘギであることは source に残す。
 *
 * **打点の配置はルンバクラーベ 3-2 と同一**（8分音符換算で 0 / 3 / 7 / 10 / 12）。
 * 既存の `Son Clave` はソンクラーベ 3-2（0 / 3 / 6 / 10 / 12）で、
 * **違うのは3つ目の打点だけ**（6 → 7）。並べて練習するために別のリズムとして持つ。
 *
 * 口唱歌で数えると:
 *
 *   カンンカ ンンンカ ンンカン カンンン
 *   ●・・●  ・・・●  ・・●・  ●・・・
 *
 * 記譜はサンバ系の正式である **2/2（アラブレーヴェ）× 2小節**。
 * 絶対 tick は 0 / 144 / 336 / 480 / 576、1周期 768 tick。
 *
 *   小節1: ♩. + ♪ + 𝄽 + 𝄾 + ♪  = 144 + 48 + 96 + 48 + 48 = 384
 *   小節2: 𝄽  + ♩ + ♩  + 𝄽  = 96 + 96 + 96 + 96   = 384
 *
 * **小節2は `Son Clave` と同じ形**（クラーベの 2 の側は両者で共通）。
 *
 * BPM は2分音符で数える（カットタイム）。BPM 100 で1周期 2.4 秒。
 *
 * 打点は8分音符で書き、次の打点までを休符で埋める。
 * 打楽器の一撃を長く伸ばして書かないため、この形になる。
 *
 * **休符は付点にせず、4分休符＋8分休符に分けて書く**（2026-09-02 オーナー判断）。
 * 付点4分休符ひとつでも鳴る音は同じだが、打楽器の譜面では付点休符を避けて
 * 分けて書く流儀があり、収録している他の6曲でも付点休符は使っていない。
 * 4分休符は拍の頭（tick 192）から始まるので、カットタイムの2拍は読める形のまま。
 *
 * 3:2 ⇄ 2:3 の入れ替えができる（`clave`）。
 */
export const RUMBA_CLAVE: Pattern = {
  id: "rumba-clave",
  name: "Rumba Clave",
  meter: { beats: 2, beatUnit: 2, beatGroups: [1, 1] },
  bpmUnit: 192,
  // 打点がルンバクラーベ 3-2 と同一であることは本人が確認済み（source 参照）。
  // この印がある間だけ 3:2 ⇄ 2:3 の入れ替えができる
  clave: "3-2",
  bars: [
    {
      items: [
        { kind: "note", id: "rc1", duration: "q", dots: 1, pitch: "high" },
        { kind: "note", id: "rc2", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q" },
        { kind: "rest", duration: "8" },
        { kind: "note", id: "rc3", duration: "8", pitch: "high" },
      ],
    },
    {
      items: [
        { kind: "rest", duration: "q" },
        { kind: "note", id: "rc4", duration: "q", pitch: "high" },
        { kind: "note", id: "rc5", duration: "q", pitch: "high" },
        { kind: "rest", duration: "q" },
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
    confirmedOn: "2026-09-02",
    arrangementNotes:
      "骨格はルンバクラーベ 3-2 と同一であることを本人が確認。収録は 3-2 の形。" +
      "記譜は 2/2（アラブレーヴェ）。打点は8分音符で書き、次の打点までを休符で埋める。" +
      "休符は付点にせず4分休符＋8分休符に分ける。",
  },
};
