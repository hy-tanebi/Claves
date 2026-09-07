import type { Pattern } from "../types";

/**
 * Son Clave。**サンバヘギの骨格タイムライン。**
 *
 * 表示名は打点の形（ソンクラーベ 3-2）から取っている。
 * 由来がサンバヘギであることは source に残す。
 *
 * 打点の配置はソンクラーベ 3-2 と同一（16分音符換算で 0 / 3 / 6 / 10 / 12）。
 * **収録するのは 3-2 のみ。** 2-3 は小節の順番を入れ替えて画面側で導く
 * （`src/domain/flip.ts`）。反転を別のリズムとして収録はしない。
 *
 * 記譜は **2/4 × 2小節**（2026-09-07 に 2/2 から移した。教則本のクラーベがこの書き方）。
 * 絶対 tick は 0 / 72 / 144 / 240 / 288、1周期 384 tick。
 *
 *   小節1: ♪. + 𝅘𝅥𝅯 + 𝄾 + ♪   = 72 + 24 + 48 + 48 = 192
 *   小節2: 𝄾  + ♪ + ♪  + 𝄾    = 48 + 48 + 48 + 48 = 192
 *
 * BPM は4分音符で数える。BPM 100 で1周期 2.4 秒（2/2 のときと同じ速さ）。
 *
 * 打点は16分音符換算で 0 / 3 / 6（1小節目）、2 / 4（2小節目）。
 * 2つ目の打点は16分音符で書き、次の打点までを8分休符で埋める。
 * 打楽器の一撃を長く伸ばして書かないため、この形になる。
 */
export const SON_CLAVE: Pattern = {
  id: "son-clave",
  name: "Son Clave",
  // 打点がソンクラーベ 3-2 と同一であることは本人が確認済み（source 参照）。
  // この印がある間だけ 3:2 ⇄ 2:3 の入れ替えができる
  clave: "3-2",
  meter: { beats: 2, beatUnit: 4, beatGroups: [1, 1] },
  bpmUnit: 96,
  bars: [
    {
      items: [
        { kind: "note", id: "sr1", duration: "8", dots: 1, pitch: "high" },
        { kind: "note", id: "sr2", duration: "16", pitch: "high" },
        { kind: "rest", duration: "8" },
        { kind: "note", id: "sr3", duration: "8", pitch: "high" },
      ],
    },
    {
      items: [
        { kind: "rest", duration: "8" },
        { kind: "note", id: "sr4", duration: "8", pitch: "high" },
        { kind: "note", id: "sr5", duration: "8", pitch: "high" },
        { kind: "rest", duration: "8" },
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
    confirmedOn: "2026-08-19",
    arrangementNotes:
      "骨格はソンクラーベ 3-2 と同一であることを本人が確認。収録は 3-2 の形。" +
      "記譜は 2/4（2026-09-07 に 2/2 から移行）。2つ目の打点は16分音符＋8分休符で書く。",
  },
};
