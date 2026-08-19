import type { Pattern } from "../types";

/**
 * サンバヘギの骨格タイムライン。
 *
 * 打点の配置はソンクラーベ 3-2 と同一（8分音符換算で 0 / 3 / 6 / 10 / 12）。
 * 3-2 のみを収録し、2-3（反転）は持たない。
 *
 * 記譜はサンバ系の正式である **2/2（アラブレーヴェ）× 2小節**。
 * 絶対 tick は 0 / 144 / 288 / 480 / 576、1周期 768 tick。
 *
 *   小節1: ♩. + ♪ + 𝄽 + ♩     = 144 + 48 + 96 + 96 = 384
 *   小節2: 𝄽  + ♩ + ♩  + 𝄽     = 96 + 96 + 96 + 96   = 384
 *
 * BPM は2分音符で数える（カットタイム）。BPM 100 で1周期 2.4 秒。
 *
 * 打点は8分音符換算で 0 / 3 / 6（1小節目）、2 / 4（2小節目）。
 * 2つ目の打点は8分音符で書き、次の打点までを4分休符で埋める。
 * 打楽器の一撃を長く伸ばして書かないため、この形になる。
 */
export const SAMBA_REGGAE: Pattern = {
  id: "samba-reggae",
  name: "Samba Reggae",
  category: "samba-reggae",
  meter: { beats: 2, beatUnit: 2, beatGroups: [1, 1] },
  bpmUnit: 192,
  bars: [
    {
      items: [
        { kind: "note", id: "sr1", duration: "q", dots: 1, pitch: "high" },
        { kind: "note", id: "sr2", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q" },
        { kind: "note", id: "sr3", duration: "q", pitch: "high" },
      ],
    },
    {
      items: [
        { kind: "rest", duration: "q" },
        { kind: "note", id: "sr4", duration: "q", pitch: "high" },
        { kind: "note", id: "sr5", duration: "q", pitch: "high" },
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
    confirmedOn: "2026-08-19",
    arrangementNotes:
      "骨格はソンクラーベ 3-2 と同一であることを本人が確認。3-2 のみ収録し反転は持たない。" +
      "記譜は 2/2（アラブレーヴェ）。2つ目の打点は8分音符＋4分休符で書く。",
  },
};
