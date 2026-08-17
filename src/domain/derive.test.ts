import { describe, expect, it } from "vitest";
import { toPlaybackEvents } from "./derive";
import { FIXTURE_4_4, FIXTURE_6_8 } from "./fixtures";
import type { Pattern } from "./types";

describe("toPlaybackEvents", () => {
  it("4/4 のフィクスチャから5つのイベントを正しい tick で導出する", () => {
    expect(toPlaybackEvents(FIXTURE_4_4)).toEqual([
      { noteId: "a1", tick: 0, pitch: "low" },
      { noteId: "a2", tick: 144, pitch: "high" },
      { noteId: "a3", tick: 288, pitch: "high" },
      { noteId: "b1", tick: 480, pitch: "low" },
      { noteId: "b2", tick: 576, pitch: "high" },
    ]);
  });

  it("6/8 のフィクスチャは小節あたり 288 tick で並ぶ", () => {
    expect(toPlaybackEvents(FIXTURE_6_8)).toEqual([
      { noteId: "c1", tick: 0, pitch: "low" },
      { noteId: "c2", tick: 48, pitch: "high" },
      { noteId: "c3", tick: 96, pitch: "high" },
      { noteId: "d1", tick: 432, pitch: "low" },
      { noteId: "d2", tick: 480, pitch: "high" },
      { noteId: "d3", tick: 528, pitch: "high" },
    ]);
  });

  it("休符はイベントにならない", () => {
    expect(toPlaybackEvents(FIXTURE_4_4)).toHaveLength(5);
  });

  it("3連符の中の音符も正しい tick になる", () => {
    const p: Pattern = {
      ...FIXTURE_4_4,
      id: "triplet",
      bars: [
        {
          items: [
            { kind: "note", id: "t1", duration: "8", pitch: "high" },
            { kind: "note", id: "t2", duration: "8", pitch: "high" },
            { kind: "note", id: "t3", duration: "8", pitch: "high" },
            { kind: "rest", duration: "h", dots: 1 },
          ],
          tuplets: [{ from: 0, to: 2, num: 3, den: 2 }],
        },
      ],
    };
    // 8分3連 = 32 tick ずつ。合計 96 tick（4分音符1つ分）
    expect(toPlaybackEvents(p).map((e) => e.tick)).toEqual([0, 32, 64]);
  });

  it("tick 昇順で返す", () => {
    const ticks = toPlaybackEvents(FIXTURE_4_4).map((e) => e.tick);
    expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
  });
});
