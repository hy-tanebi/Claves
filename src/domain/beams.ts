import { PPQ } from "./constants";
import { ticksOf, tupletAt } from "./ticks";
import type { Bar, Meter } from "./types";

const BEAMABLE = new Set<string>(["8", "16", "32"]);

/**
 * 連桁グループを算出する。返り値は items の添字範囲 [from, to]（両端含む）。
 * bar.beams が指定されていればそれを優先する。
 *
 * 規則:
 *   1. beatGroups に従って小節を tick 範囲のグループに分割する
 *   2. 各グループ内で、連桁可能な音符（8/16/32）が連続する並びを1グループとする
 *   3. 休符・w/h/q・グループ境界で連桁を切る
 *   4. 音符が1つだけになった並びは連桁しない（旗を付ける）
 *   5. 音符はそれが「始まる」グループに属するものとして扱う
 */
export function computeBeams(bar: Bar, meter: Meter): Array<[number, number]> {
  if (bar.beams) return bar.beams;

  // beatGroups から各グループの終端 tick を作る
  const unitTicks = (PPQ * 4) / meter.beatUnit;
  const boundaries: number[] = [];
  let acc = 0;
  for (const g of meter.beatGroups) {
    acc += g * unitTicks;
    boundaries.push(acc);
  }
  const groupOf = (t: number) => boundaries.findIndex((b) => t < b);

  const groups: Array<[number, number]> = [];
  let run: number[] = [];
  let currentGroup = -1;
  let tick = 0;

  const flush = () => {
    // 音符1つだけの並びは連桁しない（旗を付ける）
    if (run.length >= 2) groups.push([run[0], run[run.length - 1]]);
    run = [];
  };

  bar.items.forEach((item, i) => {
    const group = groupOf(tick);
    const beamable = item.kind === "note" && BEAMABLE.has(item.duration);

    if (!beamable || group !== currentGroup) flush();

    if (beamable) {
      run.push(i);
      currentGroup = group;
    } else {
      currentGroup = -1;
    }

    tick += ticksOf(item, tupletAt(bar, i));
  });
  flush();

  return groups;
}
