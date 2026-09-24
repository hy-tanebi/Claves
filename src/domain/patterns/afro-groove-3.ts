import type { Pattern } from "../types";

/**
 * Afro Groove3。**サンバアフロの骨格タイムライン。**
 *
 * 口唱歌で数えると:
 *
 *   ンカンカ ンカカン カンカカ ンカンカ
 *   ・●・●  ・●●・  ●・●●  ・●・●
 *
 * 16分音符換算で 1 / 3 / 5 / 6 / 8 / 10 / 11 / 13 / 15。
 * 絶対 tick は 24 / 72 / 120 / 144 / 192 / 240 / 264 / 312 / 360、1周期 384 tick。
 *
 * **収録で初めて、周期の頭が休符から始まるリズム。**
 * 他の6曲は必ず小節の頭に打点があった。ハイライトは
 * 「1周目の最初の打点まで光らせない」「2周目以降は前の周期の最後の打点が続く」
 * で扱う（`src/domain/playhead.ts`）。
 *
 * 記譜は **2/4 × 2小節**（2026-09-07 に 2/2 から移した）。
 *
 *   小節1: 𝄽(16分) ♪ 𝅘𝅥𝅯 | 𝄽(16分) 𝅘𝅥𝅯 ♪  = (24+48+24) + (24+24+48) = 192
 *   小節2: ♪ 𝅘𝅥𝅯 𝅘𝅥𝅯 | 𝄽(16分) ♪ 𝅘𝅥𝅯  = (48+24+24) + (24+48+24) = 192
 *
 * **音価が拍（4分音符＝96 tick）をまたがないように区切っている。**
 * 小節2の3つ目の打点（tick 72）は次の打点まで 48 あるが、
 * 8分音符で書くと拍の境目（96）をまたぐ。タイは v1 で使わないと
 * 決めているので、16分音符＋16分休符に分けて拍の頭を残す。
 *
 * BPM は4分音符で数える。BPM 100 で1周期 2.4 秒（2/2 のときと同じ速さ）。
 *
 * 高低の打ち分けはしない。3:2 ⇄ 2:3 の入れ替えもしない
 * （打点がクラーベの形ではないため `clave` を立てない）。
 */
export const AFRO_GROOVE_3: Pattern = {
  id: "afro-groove-3",
  name: "Afro Groove3",
  meter: { beats: 2, beatUnit: 4, beatGroups: [1, 1] },
  bpmUnit: 96,
  bars: [
    {
      items: [
        { kind: "rest", duration: "16" },
        { kind: "note", id: "af1", duration: "8", pitch: "high" },
        { kind: "note", id: "af2", duration: "16", pitch: "high" },
        { kind: "rest", duration: "16" },
        { kind: "note", id: "af3", duration: "16", pitch: "high" },
        { kind: "note", id: "af4", duration: "8", pitch: "high" },
      ],
    },
    {
      items: [
        { kind: "note", id: "af5", duration: "8", pitch: "high" },
        { kind: "note", id: "af6", duration: "16", pitch: "high" },
        { kind: "note", id: "af7", duration: "16", pitch: "high" },
        { kind: "rest", duration: "16" },
        { kind: "note", id: "af8", duration: "8", pitch: "high" },
        { kind: "note", id: "af9", duration: "16", pitch: "high" },
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
      "口唱歌「ンカンカ ンカカン カンカカ ンカンカ」を本人が確認。" +
      "記譜は 2/4（2026-09-07 に 2/2 から移行）。音価が拍（4分音符）をまたがないよう、" +
      "またぐ箇所は16分音符＋16分休符に分ける。休符は付点にしない。",
  },
};
