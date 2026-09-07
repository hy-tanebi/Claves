import type { Bar, Pattern } from "../types";

/**
 * Afro Groove。
 *
 * **Son Clave（サンバヘギの骨格）の1小節目を2回繰り返した形。** オーナーの指定による。
 * 記譜は 2/4 × 2小節で、両小節が同じ内容（2026-09-07 に 2/2 から移した）。
 *
 *   各小節: ♪. + 𝅘𝅥𝅯 + 𝄾 + ♪ = 72 + 24 + 48 + 48 = 192
 *
 * 打点は絶対 tick で 0 / 72 / 144 / 192 / 264 / 336、1周期 384 tick。
 * 16分音符換算では 0 / 3 / 6（各小節）。
 *
 * Son Clave が「1小節目 + 別の2小節目」で1周期なのに対し、
 * こちらは同じ小節を繰り返すので、周期の長さは同じでも打点が2つ多い。
 *
 * BPM は4分音符で数える。
 */
const bar = (n: 1 | 2): Bar => ({
  items: [
    { kind: "note", id: `ag${n}a`, duration: "8", dots: 1, pitch: "high" },
    { kind: "note", id: `ag${n}b`, duration: "16", pitch: "high" },
    { kind: "rest", duration: "8" },
    { kind: "note", id: `ag${n}c`, duration: "8", pitch: "high" },
  ],
});

export const AFRO_GROOVE: Pattern = {
  id: "afro-groove",
  name: "Afro Groove",
  meter: { beats: 2, beatUnit: 4, beatGroups: [1, 1] },
  bpmUnit: 96,
  bars: [bar(1), bar(2)],
  source: {
    locator: {
      type: "primary",
      person: "菅原隼人",
      role: "BOAVISTA 主宰・奏者",
    },
    transcribedBy: "菅原隼人",
    confirmedOn: "2026-08-20",
    arrangementNotes:
      "Son Clave の1小節目を2回繰り返した形として本人が指定。" +
      "記譜は 2/4（2026-09-07 に 2/2 から移行）。打点はすべて高音。" +
      "種別は名称から samba-afro としたが、本人の指定ではない。",
  },
};
