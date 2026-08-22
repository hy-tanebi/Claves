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
 * 「カン」を1拍（4分音符）、「カ」を8分音符と読むと、
 * 区切りがそのまま音価の切れ目に一致する。
 *
 *   小節1: ♪ + ♩ + ♩ + ♪ + ♩ = 48 + 96 + 96 + 48 + 96 = 384
 *   小節2: ♩ + ♩ + ♩ + ♩     = 96 × 4                  = 384
 *
 * 打点は絶対 tick で 0 / 48 / 144 / 240 / 288 / 384 / 480 / 576 / 672。
 * 8分音符換算では 0 / 1 / 3 / 5 / 6（小節1）、0 / 2 / 4 / 6（小節2）。
 *
 * **打撃を次の打点まで伸ばして書いている。**
 * 「カン」の「ン」が余韻にあたるため、短い音価＋休符ではなくこの形にした。
 * 小節1の3つ目（tick 144 の4分音符）は2分音符の拍をまたぐ。
 * 2/2 の1拍は2分音符なので、これはシンコペーションとして正しい。
 *
 * BPM は2分音符で数える（カットタイム）。
 */
export const IJEXA: Pattern = {
  id: "ijexa",
  name: "IJEXA",
  category: "candomble",
  meter: { beats: 2, beatUnit: 2, beatGroups: [1, 1] },
  bpmUnit: 192,
  bars: [
    {
      items: [
        // カ カン ＝ 高
        { kind: "note", id: "ij1", duration: "8", pitch: "high" },
        { kind: "note", id: "ij2", duration: "q", pitch: "high" },
        // カン カ カン ＝ 低
        { kind: "note", id: "ij3", duration: "q", pitch: "low" },
        { kind: "note", id: "ij4", duration: "8", pitch: "low" },
        { kind: "note", id: "ij5", duration: "q", pitch: "low" },
      ],
    },
    {
      items: [
        // カン カン ＝ 高
        { kind: "note", id: "ij6", duration: "q", pitch: "high" },
        { kind: "note", id: "ij7", duration: "q", pitch: "high" },
        // カン カン ＝ 低
        { kind: "note", id: "ij8", duration: "q", pitch: "low" },
        { kind: "note", id: "ij9", duration: "q", pitch: "low" },
      ],
    },
  ],
  source: {
    locator: {
      type: "primary",
      person: "菅原勇人",
      role: "BOAVISTA 主宰・奏者",
    },
    transcribedBy: "菅原勇人",
    confirmedOn: "2026-08-22",
    arrangementNotes:
      "口唱歌「カカンカ ンカカン カンカン カンカン」と、" +
      "高低の区切り「カカン（高）カンカカン（低）カンカン（高）カンカン（低）」による。" +
      "カン＝4分音符、カ＝8分音符として記譜した。" +
      "種別は Ijexá が候補にした位置づけから candomble としたが、本人の指定ではない。",
  },
};
