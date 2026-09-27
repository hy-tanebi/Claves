import type { Pattern } from "../types";

/**
 * Afro Groove2。
 *
 * オーナーの口唱歌は「**カカンカカン、カカンカカン**」で**2セット**。
 * このプロジェクトの約束（カ＝16分、カンは音＋その後の間）で数えると
 *
 *   カ(24) + カン(72) = 「カカン」= 96 tick（2/4 の1拍）
 *   「カカンカカン」  = 192 tick（2/4 の1小節）
 *   それが2セット     = 384 tick（2/4 の2小節）
 *
 * となり、**他のリズムと同じく2小節で1周期**になる。
 *
 *   各小節: 𝅘𝅥𝅯 + 𝅘𝅥𝅯 + 𝄾 + 𝅘𝅥𝅯 + 𝅘𝅥𝅯 + 𝄾 = 24 + 24 + 48 + 24 + 24 + 48 = 192
 *
 * 打点は絶対 tick で 0 / 24 / 96 / 120 / 192 / 216 / 288 / 312。
 * 16分音符換算では `●●・・●●・・` が2小節。
 *
 * **もともと1小節で書いていた。** 鳴る音は同じだが、
 * 1周期が半分なので譜面に小節線が出ず、
 * 「カカンカカンが2セット」という奏者の感じ方と合っていなかった。
 *
 * 打撃を次の打点まで伸ばさず、短い音価＋休符で書く
 * （Son Clave の2つ目の打点と同じ扱い）。
 * 隣り合う16分音符どうしは拍の中で連桁される。
 *
 * BPM は4分音符で数える。
 */
export const AFRO_GROOVE_2: Pattern = {
  id: "afro-groove-2",
  name: "Afro Groove2",
  meter: { beats: 2, beatUnit: 4, beatGroups: [1, 1] },
  bpmUnit: 96,
  bars: [
    {
      items: [
        { kind: "note", id: "ag2_1", duration: "16", pitch: "high" },
        { kind: "note", id: "ag2_2", duration: "16", pitch: "high" },
        { kind: "rest", duration: "8" },
        { kind: "note", id: "ag2_3", duration: "16", pitch: "high" },
        { kind: "note", id: "ag2_4", duration: "16", pitch: "high" },
        { kind: "rest", duration: "8" },
      ],
    },
    {
      items: [
        { kind: "note", id: "ag2_5", duration: "16", pitch: "high" },
        { kind: "note", id: "ag2_6", duration: "16", pitch: "high" },
        { kind: "rest", duration: "8" },
        { kind: "note", id: "ag2_7", duration: "16", pitch: "high" },
        { kind: "note", id: "ag2_8", duration: "16", pitch: "high" },
        { kind: "rest", duration: "8" },
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
      "「●●・・●●・・」という指定による。16分音符8つで 2/4 の1小節ちょうど。" +
      "打点はすべて高音（高低の指定がないため）。",
  },
};
