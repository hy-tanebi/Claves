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
