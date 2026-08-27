import type { Pattern } from "../types";

/**
 * 6/8 Afro Groove 1。
 *
 * オーナー提供の譜面画像に基づく。画像は
 *
 *   6/8 ‖: ♩ ♩ ♩ | 𝄾 ♪ 𝄾 ♪ 𝄽 :‖
 *
 * で、2小節目の最後が4分休符だった。
 * 「最後も休符ではなく同じく『ンカ』にする」という指定を受け、
 * その4分休符を `𝄾 ♪` に置き換えている。
 * さらに1小節目は `●・●・● ●`（打点を末尾に1つ足す）という指定を受け、
 * 3つ目の4分音符を8分音符2つに割っている。
 *
 *   小節1: ♩ + ♩ + ♪ + ♪       = 96 + 96 + 48 + 48 = 288
 *   小節2: (𝄾 + ♪) × 3         = (48 + 48) × 3     = 288
 *
 * 打点は絶対 tick で 0 / 96 / 192 / 240 / 336 / 432 / 528、1周期 576 tick。
 * 8分音符換算では 0 / 2 / 4 / 5（1小節目）、1 / 3 / 5（2小節目）。
 * BPM は慣習どおり付点4分音符で数える（1拍 = 144 tick）。
 *
 * 2小節目の8分音符は休符で挟まれるため連桁されず、旗が付く（画像と同じ）。
 */
export const AFRO_GROOVE_6_8: Pattern = {
  id: "afro-groove-6-8",
  name: "6/8 Afro Groove 1",
  meter: { beats: 6, beatUnit: 8, beatGroups: [3, 3] },
  bpmUnit: 144,
  bars: [
    {
      items: [
        { kind: "note", id: "se1", duration: "q", pitch: "high" },
        { kind: "note", id: "se2", duration: "q", pitch: "high" },
        { kind: "note", id: "se3", duration: "8", pitch: "high" },
        { kind: "note", id: "se3b", duration: "8", pitch: "high" },
      ],
    },
    {
      items: [
        { kind: "rest", duration: "8" },
        { kind: "note", id: "se4", duration: "8", pitch: "high" },
        { kind: "rest", duration: "8" },
        { kind: "note", id: "se5", duration: "8", pitch: "high" },
        { kind: "rest", duration: "8" },
        { kind: "note", id: "se6", duration: "8", pitch: "high" },
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
      "オーナー提供の譜面画像による。画像では2小節目の最後が4分休符だが、" +
      "「最後も同じく『ンカ』にする」という指定でその休符を 𝄾 + ♪ に置き換えた。" +
      "1小節目は「●・●・● ●」という指定で、3つ目の4分音符を8分音符2つに割っている。" +
      "打点はすべて高音（画像に高低の区別がないため）。",
  },
};
