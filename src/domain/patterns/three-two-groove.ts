import type { Pattern } from "../types";

/**
 * 3-2 Groove。**サンバヘギの骨格タイムライン。**
 *
 * 表示名は打点の形（ソンクラーベ 3-2）から取っている。
 * 由来がサンバヘギであることは source に残す。
 *
 * 打点の配置はソンクラーベ 3-2 と同一（8分音符換算で 0 / 3 / 6 / 10 / 12）。
 * **収録するのは 3-2 のみ。** 2-3 は小節の順番を入れ替えて画面側で導く
 * （`src/domain/flip.ts`）。反転を別のリズムとして収録はしない。
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
export const THREE_TWO_GROOVE: Pattern = {
  id: "three-two-groove",
  name: "3-2 Groove",
  // 打点がソンクラーベ 3-2 と同一であることは本人が確認済み（source 参照）。
  // この印がある間だけ 3:2 ⇄ 2:3 の入れ替えができる
  clave: "3-2",
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
      "骨格はソンクラーベ 3-2 と同一であることを本人が確認。収録は 3-2 の形。" +
      "記譜は 2/2（アラブレーヴェ）。2つ目の打点は8分音符＋4分休符で書く。",
  },
};
