import type { Pattern } from "../types";

/**
 * Afro Groove2。
 *
 * オーナーの口唱歌は「**カカンカカン、カカンカカン**」で**2セット**。
 * このプロジェクトの約束（カ＝8分、カンは音＋その後の間）で数えると
 *
 *   カ(48) + カン(144) = 「カカン」= 192 tick（2/2 の半小節）
 *   「カカンカカン」   = 384 tick（2/2 の1小節）
 *   それが2セット      = 768 tick（2/2 の2小節）
 *
 * となり、**他のリズムと同じく2小節で1周期**になる。
 *
 *   各小節: ♪ + ♪ + 𝄽 + ♪ + ♪ + 𝄽 = 48 + 48 + 96 + 48 + 48 + 96 = 384
 *
 * 打点は絶対 tick で 0 / 48 / 192 / 240 / 384 / 432 / 576 / 624。
 * 8分音符換算では `●●・・●●・・` が2小節。
 *
 * **もともと1小節で書いていた。** 鳴る音は同じだが、
 * 1周期が半分なので譜面に小節線が出ず、
 * 「カカンカカンが2セット」という奏者の感じ方と合っていなかった。
 *
 * 打撃を次の打点まで伸ばさず、短い音価＋休符で書く
 * （Son Clave の2つ目の打点と同じ扱い）。
 * 隣り合う8分音符どうしは拍の中で連桁される。
 *
 * BPM は2分音符で数える（カットタイム）。
 */
export const AFRO_GROOVE_2: Pattern = {
  id: "afro-groove-2",
  name: "Afro Groove2",
  meter: { beats: 2, beatUnit: 2, beatGroups: [1, 1] },
  bpmUnit: 192,
  bars: [
    {
      items: [
        { kind: "note", id: "ag2_1", duration: "8", pitch: "high" },
        { kind: "note", id: "ag2_2", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q" },
        { kind: "note", id: "ag2_3", duration: "8", pitch: "high" },
        { kind: "note", id: "ag2_4", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q" },
      ],
    },
    {
      items: [
        { kind: "note", id: "ag2_5", duration: "8", pitch: "high" },
        { kind: "note", id: "ag2_6", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q" },
        { kind: "note", id: "ag2_7", duration: "8", pitch: "high" },
        { kind: "note", id: "ag2_8", duration: "8", pitch: "high" },
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
    confirmedOn: "2026-08-22",
    arrangementNotes:
      "「●●・・●●・・ の 2/2」という指定による。8分音符8つで 2/2 の1小節ちょうど。" +
      "打点はすべて高音（高低の指定がないため）。",
  },
};
