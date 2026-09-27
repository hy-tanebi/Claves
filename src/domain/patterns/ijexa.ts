import type { Pattern } from "../types";

/**
 * IJEXA。**このアプリで初めて高低を打ち分けるリズム。**
 *
 * オーナーの口唱歌による指定:
 *
 *   カカンカ ンカカン カンカン カンカン
 *
 * 高低の区切りも同じ16文字を別の位置で切ったもので、
 *
 *   カカン（高） カンカカン（低） カンカン（高） カンカン（低）
 *
 * 「カン」を1拍の半分（8分音符）、「カ」を16分音符と読むと、
 * 区切りがそのまま音価の切れ目に一致する。
 *
 *   小節1: 𝅘𝅥𝅯 + ♪ + ♪ + 𝅘𝅥𝅯 + ♪ = 24 + 48 + 48 + 24 + 48 = 192
 *   小節2: ♪ + ♪ + ♪ + ♪       = 48 × 4                = 192
 *
 * 打点は絶対 tick で 0 / 24 / 72 / 120 / 144 / 192 / 240 / 288 / 336。
 * 16分音符換算では 0 / 1 / 3 / 5 / 6（小節1）、0 / 2 / 4 / 6（小節2）。
 *
 * **打撃を次の打点まで伸ばして書いている。**
 * 「カン」の「ン」が余韻にあたるため、短い音価＋休符ではなくこの形にした。
 * 小節1の3つ目（tick 72 の8分音符）は4分音符の拍をまたぐ。
 * 2/4 の1拍は4分音符なので、これはシンコペーションとして正しい。
 *
 * BPM は4分音符で数える（2026-09-07 に 2/2 から移した）。
 */
export const IJEXA: Pattern = {
  id: "ijexa",
  name: "IJEXA",
  meter: { beats: 2, beatUnit: 4, beatGroups: [1, 1] },
  bpmUnit: 96,
  bars: [
    {
      items: [
        // カ カン ＝ 高
        { kind: "note", id: "ij1", duration: "16", pitch: "high" },
        { kind: "note", id: "ij2", duration: "8", pitch: "high" },
        // カン カ カン ＝ 低
        { kind: "note", id: "ij3", duration: "8", pitch: "low" },
        { kind: "note", id: "ij4", duration: "16", pitch: "low" },
        { kind: "note", id: "ij5", duration: "8", pitch: "low" },
      ],
    },
    {
      items: [
        // カン カン ＝ 高
        { kind: "note", id: "ij6", duration: "8", pitch: "high" },
        { kind: "note", id: "ij7", duration: "8", pitch: "high" },
        // カン カン ＝ 低
        { kind: "note", id: "ij8", duration: "8", pitch: "low" },
        { kind: "note", id: "ij9", duration: "8", pitch: "low" },
      ],
    },
  ],
  source: {
    locator: {
      type: "primary",
      person: "作者",
      role: "奏者",
    },
    transcribedBy: "作者",
    confirmedOn: "2026-08-22",
    arrangementNotes:
      "口唱歌「カカンカ ンカカン カンカン カンカン」と、" +
      "高低の区切り「カカン（高）カンカカン（低）カンカン（高）カンカン（低）」による。" +
      "カン＝4分音符、カ＝8分音符として記譜した。",
  },
};
