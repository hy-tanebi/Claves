import type { Pattern } from "../types";

/**
 * 6/8 Afro Groove 2。
 *
 * オーナーの口唱歌「カンカカン、カンカカン」による。
 * このプロジェクトの約束で **カ＝8分音符、カン＝4分音符**。
 *
 *   カン(96) + カ(48) + カン(96) = 240
 *
 * で 6/8 の1小節（288 tick）に8分音符1つぶん足りない。
 * その余りを**最後の「カン」を付点4分音符に伸ばして埋める**という指定を受けた
 * （4分音符＋8分休符と書いても打点は同じだが、6/8 の 3+3 の区切りに合うこちらを採る）。
 *
 *   小節1: ♩ + ♪ + ♩.  = 96 + 48 + 144 = 288
 *   小節2: 同じ
 *
 * 打点は絶対 tick で 0 / 96 / 144 / 288 / 384 / 432、1周期 576 tick。
 * 8分音符換算では `● ・ ● ● ・ ・` が2回。
 * BPM は慣習どおり付点4分音符で数える（1拍 = 144 tick）。
 *
 * 高低は打ち分けない（打ち分けるのは IJEXA だけという方針）。
 */
export const AFRO_GROOVE_6_8_2: Pattern = {
  id: "afro-groove-6-8-2",
  name: "6/8 Afro Groove 2",
  meter: { beats: 6, beatUnit: 8, beatGroups: [3, 3] },
  bpmUnit: 144,
  bars: [
    {
      items: [
        { kind: "note", id: "sf1", duration: "q", pitch: "high" },
        { kind: "note", id: "sf2", duration: "8", pitch: "high" },
        { kind: "note", id: "sf3", duration: "q", dots: 1, pitch: "high" },
      ],
    },
    {
      items: [
        { kind: "note", id: "sf4", duration: "q", pitch: "high" },
        { kind: "note", id: "sf5", duration: "8", pitch: "high" },
        { kind: "note", id: "sf6", duration: "q", dots: 1, pitch: "high" },
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
    confirmedOn: "2026-08-27",
    arrangementNotes:
      "オーナーの口唱歌「カンカカン、カンカカン」による（カ＝8分、カン＝4分）。" +
      "1小節に8分音符1つぶん余るため、最後の「カン」を付点4分音符に伸ばして埋める" +
      "という指定を受けた。4分音符＋8分休符と書いても打点は同じだが、" +
      "6/8 の 3+3 の区切りに合う付点4分を採っている。" +
      "打点はすべて高音（高低を打ち分けるのは IJEXA だけという方針）。",
  },
};
