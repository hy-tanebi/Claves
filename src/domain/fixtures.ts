import type { Pattern, SourceMeta } from "./types";

const TEST_SOURCE: SourceMeta = {
  locator: { type: "primary", person: "(test fixture)", role: "n/a" },
  transcribedBy: "(test fixture)",
  confirmedOn: "2026-08-17",
  arrangementNotes: "テスト専用。音楽的な正しさは主張しない。",
};

/**
 * 4/4 × 2小節。音符は tick 0 / 144 / 288 / 480 / 576 の5つ。総 tick 768。
 * 小節1: 8分 + 4分休符 + 8分 + 4分休符 + 8分 + 8分休符   = 384
 * 小節2: 4分休符 + 8分 + 8分休符 + 8分 + 付点4分休符      = 384
 */
export const FIXTURE_4_4: Pattern = {
  id: "fixture-4-4",
  name: "Fixture 4/4",
  category: "samba-reggae",
  meter: { beats: 4, beatUnit: 4, beatGroups: [1, 1, 1, 1] },
  bpmUnit: 96,
  bars: [
    {
      items: [
        { kind: "note", id: "a1", duration: "8", pitch: "low" },
        { kind: "rest", duration: "q" },
        { kind: "note", id: "a2", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q" },
        { kind: "note", id: "a3", duration: "8", pitch: "high" },
        { kind: "rest", duration: "8" },
      ],
    },
    {
      items: [
        { kind: "rest", duration: "q" },
        { kind: "note", id: "b1", duration: "8", pitch: "low" },
        { kind: "rest", duration: "8" },
        { kind: "note", id: "b2", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q", dots: 1 },
      ],
    },
  ],
  source: TEST_SOURCE,
};

/**
 * 2/4 × 4小節。サンバ系の正式な記譜（1小節 = 192 tick、総 tick 768）。
 *
 * 打点はソンクラーベ 3-2 と同じ配置（8分音符換算で 0/3/6/10/12）。
 * 絶対 tick は 0 / 144 / 288 / 480 / 576 で、FIXTURE_4_4 と完全に一致する。
 * 同じリズムを小節線の切り方だけ変えて書いたもので、
 * 「拍子が変わっても打点の絶対位置は変わらない」ことの検証に使う。
 *
 * 小節1: 8分 + 4分休符 + 8分          = 192
 * 小節2: 4分休符 + 8分 + 8分休符      = 192
 * 小節3: 4分休符 + 8分 + 8分休符      = 192
 * 小節4: 8分 + 付点4分休符            = 192
 */
export const FIXTURE_2_4: Pattern = {
  id: "fixture-2-4",
  name: "Fixture 2/4",
  category: "samba-reggae",
  meter: { beats: 2, beatUnit: 4, beatGroups: [1, 1] },
  bpmUnit: 96,
  bars: [
    {
      items: [
        { kind: "note", id: "s1", duration: "8", pitch: "low" },
        { kind: "rest", duration: "q" },
        { kind: "note", id: "s2", duration: "8", pitch: "high" },
      ],
    },
    {
      items: [
        { kind: "rest", duration: "q" },
        { kind: "note", id: "s3", duration: "8", pitch: "high" },
        { kind: "rest", duration: "8" },
      ],
    },
    {
      items: [
        { kind: "rest", duration: "q" },
        { kind: "note", id: "s4", duration: "8", pitch: "low" },
        { kind: "rest", duration: "8" },
      ],
    },
    {
      items: [
        { kind: "note", id: "s5", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q", dots: 1 },
      ],
    },
  ],
  source: TEST_SOURCE,
};

/** 6/8 × 2小節。1小節 = 288 tick。音符は tick 0 / 48 / 96 / 432 / 480 / 528。 */
export const FIXTURE_6_8: Pattern = {
  id: "fixture-6-8",
  name: "Fixture 6/8",
  category: "candomble",
  meter: { beats: 6, beatUnit: 8, beatGroups: [3, 3] },
  bpmUnit: 144,
  bars: [
    {
      items: [
        { kind: "note", id: "c1", duration: "8", pitch: "low" },
        { kind: "note", id: "c2", duration: "8", pitch: "high" },
        { kind: "note", id: "c3", duration: "8", pitch: "high" },
        { kind: "rest", duration: "q", dots: 1 },
      ],
    },
    {
      items: [
        { kind: "rest", duration: "q", dots: 1 },
        { kind: "note", id: "d1", duration: "8", pitch: "low" },
        { kind: "note", id: "d2", duration: "8", pitch: "high" },
        { kind: "note", id: "d3", duration: "8", pitch: "high" },
      ],
    },
  ],
  source: TEST_SOURCE,
};
