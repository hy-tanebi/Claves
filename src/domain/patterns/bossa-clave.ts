import type { Pattern } from "../types";

/**
 * Bossa Clave。**サンバヘギの骨格タイムライン。**
 *
 * 口唱歌で数えると:
 *
 *   カンンカ ンンカン ンンカン ンカンン
 *   ●・・●  ・・●・  ・・●・  ・●・・
 *
 * 16分音符換算で 0 / 3 / 6 / 10 / 13。
 * 絶対 tick は 0 / 72 / 144 / 240 / 312、1周期 384 tick。
 *
 * **ボサクラーベ 3-2 と同一。** 収録時（2026-09-03）は
 * 「ソンでもルンバでもない」としか分からなかったが、2026-09-07 に
 * 教則本の記譜と突き合わせて正体が確定した。
 *
 * 3種のクラーベの関係:
 *
 *   Son Clave    0 / 3 / 6 / 10 / 12
 *   Rumba Clave  0 / 3 / 7 / 10 / 12   ソンの3つ目が1つ後ろ
 *   Bossa Clave  0 / 3 / 6 / 10 / 13   ソンの5つ目が1つ後ろ
 *
 * 教則本の言い方では「ソンクラーベとの違いは、ひとつのアクセントが
 * 16分音符ぶんずれていること」。**小節1は Son Clave と同じ形**（0 / 3 / 6）で、
 * 違うのは最後の打点だけ。
 *
 * 記譜は **2/4 × 2小節**（2026-09-07 に 2/2 から移した）。
 *
 *   小節1: ♪. 𝅘𝅥𝅯 | 𝄾 ♪      = (72+24) + (48+48) = 192
 *   小節2: 𝄾 ♪  | 𝄽(16分) ♪ 𝄽(16分)  = (48+48) + (24+48+24) = 192
 *
 * **音価が拍（4分音符＝96 tick）をまたがないように区切っている。**
 * タイは v1 で使わないと決めているため。休符は付点にしない。
 *
 * BPM は4分音符で数える。BPM 100 で1周期 2.4 秒（2/2 のときと同じ速さ）。
 *
 * 高低の打ち分けはしない。3:2 ⇄ 2:3 の入れ替えができる（`clave`）。
 */
export const BOSSA_CLAVE: Pattern = {
  id: "bossa-clave",
  name: "Bossa Clave",
  meter: { beats: 2, beatUnit: 4, beatGroups: [1, 1] },
  bpmUnit: 96,
  // 前半3打・後半2打の 3-2 型であることは本人が確認済み（source 参照）。
  // この印がある間だけ 3:2 ⇄ 2:3 の入れ替えができる
  clave: "3-2",
  bars: [
    {
      items: [
        { kind: "note", id: "tg1", duration: "8", dots: 1, pitch: "high" },
        { kind: "note", id: "tg2", duration: "16", pitch: "high" },
        { kind: "rest", duration: "8" },
        { kind: "note", id: "tg3", duration: "8", pitch: "high" },
      ],
    },
    {
      items: [
        { kind: "rest", duration: "8" },
        { kind: "note", id: "tg4", duration: "8", pitch: "high" },
        { kind: "rest", duration: "16" },
        { kind: "note", id: "tg5", duration: "8", pitch: "high" },
        { kind: "rest", duration: "16" },
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
      "口唱歌「カンンカ ンンカン ンンカン ンカンン」を本人が確認（2026-09-03）。" +
      "2026-09-07、教則本の記譜と突き合わせてボサクラーベ 3-2 と同一であることを確認。" +
      "ソンクラーベとの違いは5つ目の打点が16分ぶん後ろにあること。" +
      "3-2 の形で収録し、2-3 は入れ替えで導く。" +
      "記譜は 2/4（2026-09-07 に 2/2 から移行）。音価が拍をまたがないよう区切り、休符は付点にしない。",
  },
};
