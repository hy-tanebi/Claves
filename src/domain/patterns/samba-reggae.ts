import type { Pattern } from "../types";

/**
 * サンバヘギの骨格タイムライン。
 *
 * 打点の配置はソンクラーベ 3-2 と同一（8分音符換算で 0 / 3 / 6 / 10 / 12）。
 * 3-2 のみを収録し、2-3（反転）は持たない。
 *
 * 記譜はサンバ系の正式である 2/4 × 4小節。
 * 絶対 tick は 0 / 144 / 288 / 480 / 576、1周期 768 tick。
 *
 *   小節1: ♪ + 𝄽(4分) + ♪            = 192
 *   小節2: 𝄽(4分) + ♪ + 𝄾(8分)       = 192
 *   小節3: 𝄽(4分) + ♪ + 𝄾(8分)       = 192
 *   小節4: ♪ + 𝄽.(付点4分)           = 192
 */
export const SAMBA_REGGAE: Pattern = {
  id: "samba-reggae",
  name: "Samba Reggae",
  category: "samba-reggae",
  meter: { beats: 2, beatUnit: 4, beatGroups: [1, 1] },
  bpmUnit: 96,
  bars: [
    {
      items: [
        { kind: "note", id: "sr1", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q" },
        { kind: "note", id: "sr2", duration: "8", pitch: "high" },
      ],
    },
    {
      items: [
        { kind: "rest", duration: "q" },
        { kind: "note", id: "sr3", duration: "8", pitch: "high" },
        { kind: "rest", duration: "8" },
      ],
    },
    {
      items: [
        { kind: "rest", duration: "q" },
        { kind: "note", id: "sr4", duration: "8", pitch: "high" },
        { kind: "rest", duration: "8" },
      ],
    },
    {
      items: [
        { kind: "note", id: "sr5", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q", dots: 1 },
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
    confirmedOn: "2026-08-13",
    arrangementNotes:
      "骨格はソンクラーベ 3-2 と同一であることを本人が確認。3-2 のみ収録し反転は持たない。",
  },
};
