import type { Pattern } from "../types";

/**
 * Afro Groove3。**サンバアフロの骨格タイムライン。**
 *
 * 口唱歌で数えると:
 *
 *   ンカンカ ンカカン カンカカ ンカンカ
 *   ・●・●  ・●●・  ●・●●  ・●・●
 *
 * 8分音符換算で 1 / 3 / 5 / 6 / 8 / 10 / 11 / 13 / 15。
 * 絶対 tick は 48 / 144 / 240 / 288 / 384 / 480 / 528 / 624 / 720、1周期 768 tick。
 *
 * **収録で初めて、周期の頭が休符から始まるリズム。**
 * 他の6曲は必ず小節の頭に打点があった。ハイライトは
 * 「1周目の最初の打点まで光らせない」「2周目以降は前の周期の最後の打点が続く」
 * で扱う（`src/domain/playhead.ts`）。
 *
 * 記譜はサンバ系の正式である **2/2（アラブレーヴェ）× 2小節**。
 *
 *   小節1: 𝄾 ♩ ♪ | 𝄾 ♪ ♩  = (48+96+48) + (48+48+96) = 384
 *   小節2: ♩ ♪ ♪ | 𝄾 ♩ ♪  = (96+48+48) + (48+96+48) = 384
 *
 * **音価が拍（2分音符＝192 tick）をまたがないように区切っている。**
 * 小節2の3つ目の打点（tick 144）は次の打点まで 96 あるが、
 * 4分音符で書くと拍の境目（192）をまたぐ。タイは v1 で使わないと
 * 決めているので、8分音符＋8分休符に分けて拍の頭を残す。
 *
 * BPM は2分音符で数える（カットタイム）。BPM 100 で1周期 2.4 秒。
 *
 * 高低の打ち分けはしない。3:2 ⇄ 2:3 の入れ替えもしない
 * （打点がクラーベの形ではないため `clave` を立てない）。
 */
export const AFRO_GROOVE_3: Pattern = {
  id: "afro-groove-3",
  name: "Afro Groove3",
  meter: { beats: 2, beatUnit: 2, beatGroups: [1, 1] },
  bpmUnit: 192,
  bars: [
    {
      items: [
        { kind: "rest", duration: "8" },
        { kind: "note", id: "af1", duration: "q", pitch: "high" },
        { kind: "note", id: "af2", duration: "8", pitch: "high" },
        { kind: "rest", duration: "8" },
        { kind: "note", id: "af3", duration: "8", pitch: "high" },
        { kind: "note", id: "af4", duration: "q", pitch: "high" },
      ],
    },
    {
      items: [
        { kind: "note", id: "af5", duration: "q", pitch: "high" },
        { kind: "note", id: "af6", duration: "8", pitch: "high" },
        { kind: "note", id: "af7", duration: "8", pitch: "high" },
        { kind: "rest", duration: "8" },
        { kind: "note", id: "af8", duration: "q", pitch: "high" },
        { kind: "note", id: "af9", duration: "8", pitch: "high" },
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
      "記譜は 2/2（アラブレーヴェ）。音価が拍（2分音符）をまたがないよう、" +
      "またぐ箇所は8分音符＋8分休符に分ける。休符は付点にしない。",
  },
};
