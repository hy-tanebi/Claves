import type { Pattern } from "../types";

/**
 * Afro Groove2 の 4/4 版。**2/2 版と見比べるために置いている**（2026-08-27 オーナー依頼）。
 *
 * **打点の並びも1周期の長さも 2/2 版とまったく同じ。** 違うのは数え方だけ。
 *
 *   2/2: 1拍 = 2分音符（bpmUnit 192）→ 1小節 = 2拍
 *   4/4: 1拍 = 4分音符（bpmUnit  96）→ 1小節 = 4拍
 *
 * 小節の長さ（384 tick）は両者で同じなので、音符の並びは変わらない。
 * ただし **1拍の長さが半分になるため、同じ BPM の数字では速さが倍違う**
 * （2/2 の 120 BPM と同じ速さにするには、こちらは 240 BPM にする）。
 *
 *   各小節: ♪ + ♪ + 𝄽 + ♪ + ♪ + 𝄽 = 48 + 48 + 96 + 48 + 48 + 96 = 384
 *
 * 打点は絶対 tick で 0 / 48 / 192 / 240 / 384 / 432 / 576 / 624、1周期 768 tick。
 *
 * サンバ系は 2 で数えるのが記譜の慣習だが、**奏者が4つで数えている実感があるなら
 * そちらに合わせるべき**という判断で、両方を置いて比べられるようにした。
 * どちらを残すかはオーナーが決める。
 */
export const AFRO_GROOVE_2_4_4: Pattern = {
  id: "afro-groove-2-4-4",
  name: "Afro Groove2 (4/4)",
  meter: { beats: 4, beatUnit: 4, beatGroups: [1, 1, 1, 1] },
  bpmUnit: 96,
  bars: [
    {
      items: [
        { kind: "note", id: "ag2q_1", duration: "8", pitch: "high" },
        { kind: "note", id: "ag2q_2", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q" },
        { kind: "note", id: "ag2q_3", duration: "8", pitch: "high" },
        { kind: "note", id: "ag2q_4", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q" },
      ],
    },
    {
      items: [
        { kind: "note", id: "ag2q_5", duration: "8", pitch: "high" },
        { kind: "note", id: "ag2q_6", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q" },
        { kind: "note", id: "ag2q_7", duration: "8", pitch: "high" },
        { kind: "note", id: "ag2q_8", duration: "8", pitch: "high" },
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
    confirmedOn: "2026-08-27",
    arrangementNotes:
      "Afro Groove2 と同じリズムを 4/4 で数え直したもの。打点の並びは変えていない。" +
      "2/2 と 4/4 のどちらが演奏の感覚に合うかを見比べるためにオーナーの依頼で追加した。" +
      "打点はすべて高音（高低を打ち分けるのは IJEXA だけという方針）。",
  },
};
