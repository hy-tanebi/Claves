import { describe, expect, it } from "vitest";
import { computeBeams } from "./beams";
import type { Bar, Duration, Meter, NotationItem } from "./types";

const METER_4_4: Meter = { beats: 4, beatUnit: 4, beatGroups: [1, 1, 1, 1] };
const METER_6_8: Meter = { beats: 6, beatUnit: 8, beatGroups: [3, 3] };

let seq = 0;
const n = (duration: Duration, dots?: 0 | 1): NotationItem => ({
  kind: "note",
  id: `n${seq++}`,
  duration,
  dots,
  pitch: "high",
});
const r = (duration: Duration, dots?: 0 | 1): NotationItem => ({ kind: "rest", duration, dots });

describe("computeBeams", () => {
  it("4/4 の8分音符8つは拍ごとに2つずつ連桁される", () => {
    const bar: Bar = { items: [n("8"), n("8"), n("8"), n("8"), n("8"), n("8"), n("8"), n("8")] };
    expect(computeBeams(bar, METER_4_4)).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
    ]);
  });

  it("6/8 の8分音符6つは 3+3 で連桁される", () => {
    const bar: Bar = { items: [n("8"), n("8"), n("8"), n("8"), n("8"), n("8")] };
    expect(computeBeams(bar, METER_6_8)).toEqual([
      [0, 2],
      [3, 5],
    ]);
  });

  it("休符で連桁が切れる", () => {
    const bar: Bar = { items: [n("8"), n("8"), r("8"), n("8"), n("h")] };
    expect(computeBeams(bar, METER_4_4)).toEqual([[0, 1]]);
  });

  it("4分音符以上は連桁されず、そこで切れる", () => {
    const bar: Bar = { items: [n("8"), n("8"), n("q"), n("8"), n("8"), n("q")] };
    expect(computeBeams(bar, METER_4_4)).toEqual([
      [0, 1],
      [3, 4],
    ]);
  });

  it("音符が1つだけのグループは連桁しない", () => {
    const bar: Bar = { items: [n("8"), r("8"), n("8"), n("8"), n("h")] };
    expect(computeBeams(bar, METER_4_4)).toEqual([[2, 3]]);
  });

  it("拍のグループをまたぐ連桁は作らない", () => {
    const bar: Bar = {
      items: [n("16"), n("16"), n("16"), n("16"), n("16"), n("16"), n("16"), n("16"), n("h")],
    };
    expect(computeBeams(bar, METER_4_4)).toEqual([
      [0, 3],
      [4, 7],
    ]);
  });

  it("明示的な beams が指定されていればそれをそのまま返す", () => {
    const bar: Bar = { items: [n("8"), n("8"), n("8"), n("8"), n("h")], beams: [[0, 3]] };
    expect(computeBeams(bar, METER_4_4)).toEqual([[0, 3]]);
  });
});
