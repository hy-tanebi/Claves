import type { Bar, Pattern } from "../types";

/**
 * Afro Groove。
 *
 * **3-2 Groove（サンバヘギの骨格）の1小節目を2回繰り返した形。** オーナーの指定による。
 * 記譜は 2/2（アラブレーヴェ）× 2小節で、両小節が同じ内容。
 *
 *   各小節: ♩. + ♪ + 𝄽 + ♩ = 144 + 48 + 96 + 96 = 384
 *
 * 打点は絶対 tick で 0 / 144 / 288 / 384 / 528 / 672、1周期 768 tick。
 * 8分音符換算では 0 / 3 / 6（各小節）。
 *
 * 3-2 Groove が「1小節目 + 別の2小節目」で1周期なのに対し、
 * こちらは同じ小節を繰り返すので、周期の長さは同じでも打点が2つ多い。
 *
 * BPM は2分音符で数える（カットタイム）。
 */
const bar = (n: 1 | 2): Bar => ({
  items: [
    { kind: "note", id: `ag${n}a`, duration: "q", dots: 1, pitch: "high" },
    { kind: "note", id: `ag${n}b`, duration: "8", pitch: "high" },
    { kind: "rest", duration: "q" },
    { kind: "note", id: `ag${n}c`, duration: "q", pitch: "high" },
  ],
});

export const AFRO_GROOVE: Pattern = {
  id: "afro-groove",
  name: "Afro Groove",
  meter: { beats: 2, beatUnit: 2, beatGroups: [1, 1] },
  bpmUnit: 192,
  bars: [bar(1), bar(2)],
  source: {
    locator: {
      type: "primary",
      person: "菅原勇人",
      role: "BOAVISTA 主宰・奏者",
    },
    transcribedBy: "菅原勇人",
    confirmedOn: "2026-08-20",
    arrangementNotes:
      "3-2 Groove の1小節目を2回繰り返した形として本人が指定。" +
      "記譜は 2/2（アラブレーヴェ）。打点はすべて高音。" +
      "種別は名称から samba-afro としたが、本人の指定ではない。",
  },
};
