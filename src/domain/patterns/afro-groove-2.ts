import type { Pattern } from "../types";

/**
 * Afro Groove2。
 *
 * オーナーの指定は「`●●・・●●・・` の 2/2」。
 * 8分音符8つ＝2/2 の1小節ちょうどなので、**1小節で1周期**になる。
 *
 *   小節: ♪ + ♪ + 𝄽 + ♪ + ♪ + 𝄽 = 48 + 48 + 96 + 48 + 48 + 96 = 384
 *
 * 打点は絶対 tick で 0 / 48 / 192 / 240。8分音符換算では 0 / 1 / 4 / 5。
 * 2つ叩いて2つ休む形が、1小節に2回入る。
 *
 * 打撃を次の打点まで伸ばさず、短い音価＋休符で書く
 * （Samba Reggae の2つ目の打点と同じ扱い）。
 * 隣り合う8分音符どうしは拍の中で連桁される。
 *
 * BPM は2分音符で数える（カットタイム）。
 */
export const AFRO_GROOVE_2: Pattern = {
  id: "afro-groove-2",
  name: "Afro Groove2",
  category: "samba-afro",
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
      "「●●・・●●・・ の 2/2」という指定による。8分音符8つで 2/2 の1小節ちょうど。" +
      "打点はすべて高音（高低の指定がないため）。",
  },
};
