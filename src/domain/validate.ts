import { barTicks, ticksOf, tupletAt } from "./ticks";
import type { Bar, Pattern } from "./types";

const BEAMABLE = new Set<string>(["8", "16", "32"]);

const ALLOWED_METERS = [
  { beats: 4, beatUnit: 4, bpmUnit: 96 },
  { beats: 6, beatUnit: 8, bpmUnit: 144 },
] as const;

/**
 * パターンを検証する。妥当なら空配列、そうでなければエラーメッセージの配列を返す。
 * 壊れた譜面データを静かに誤再生させないことが目的。
 */
export function validatePattern(p: Pattern): string[] {
  const errors: string[] = [];

  const rule = ALLOWED_METERS.find(
    (m) => m.beats === p.meter.beats && m.beatUnit === p.meter.beatUnit,
  );
  if (!rule) {
    errors.push(
      `meter ${p.meter.beats}/${p.meter.beatUnit} is not allowed (v1 supports 4/4 and 6/8)`,
    );
  } else if (p.bpmUnit !== rule.bpmUnit) {
    errors.push(
      `bpmUnit must be ${rule.bpmUnit} for ${p.meter.beats}/${p.meter.beatUnit}, got ${p.bpmUnit}`,
    );
  }

  if (p.meter.beatGroups.some((g) => !Number.isInteger(g) || g <= 0)) {
    errors.push("beatGroups must contain only positive integers");
  }
  const groupSum = p.meter.beatGroups.reduce((a, b) => a + b, 0);
  if (groupSum !== p.meter.beats) {
    errors.push(`sum(beatGroups)=${groupSum} must equal meter.beats=${p.meter.beats}`);
  }

  if (p.bars.length < 1) errors.push("bars must contain at least one bar");

  const expected = rule ? barTicks(p.meter) : null;
  const ids = new Set<string>();
  const absTicks = new Set<number>();
  let noteCount = 0;
  let barStart = 0;

  p.bars.forEach((bar, bi) => {
    errors.push(...validateRanges(bar, bi));
    errors.push(...validateTupletTotals(bar, bi));

    let sum = 0;
    bar.items.forEach((item, i) => {
      if ("tie" in item) errors.push(`bar ${bi} item ${i}: tie is not supported in v1`);

      const t = ticksOf(item, tupletAt(bar, i));
      if (!Number.isInteger(t)) {
        errors.push(`bar ${bi} item ${i}: ticks ${t} is not an integer`);
      }

      if (item.kind === "note") {
        noteCount++;
        if (ids.has(item.id)) errors.push(`duplicate note id "${item.id}"`);
        ids.add(item.id);

        // 小節長が正しければ構造上この衝突は起きないが、防御的に検査する
        const abs = barStart + sum;
        if (absTicks.has(abs)) {
          errors.push(`two notes share tick ${abs} (simultaneous notes are not allowed in v1)`);
        }
        absTicks.add(abs);
      }

      sum += t;
    });

    if (expected !== null && sum !== expected) {
      errors.push(`bar ${bi}: tick sum ${sum} does not equal ${expected}`);
    }
    barStart += expected ?? sum;
  });

  if (noteCount === 0) errors.push("pattern must contain at least one note");

  if (!p.source?.locator) errors.push("source.locator is required");
  if (!p.source?.transcribedBy) errors.push("source.transcribedBy is required");
  if (!p.source?.confirmedOn) errors.push("source.confirmedOn is required");

  return errors;
}

/** 連符グループ全体の tick 合計が整数であることを検査する */
function validateTupletTotals(bar: Bar, bi: number): string[] {
  const errors: string[] = [];
  (bar.tuplets ?? []).forEach((t, k) => {
    if (t.from < 0 || t.to >= bar.items.length || t.from > t.to) return; // 範囲検査は別途
    let sum = 0;
    for (let i = t.from; i <= t.to; i++) sum += ticksOf(bar.items[i]!, t);
    if (!Number.isInteger(sum)) {
      errors.push(`bar ${bi}: tuplets[${k}] total ticks ${sum} is not an integer`);
    }
  });
  return errors;
}

function validateRanges(bar: Bar, bi: number): string[] {
  const errors: string[] = [];
  const n = bar.items.length;

  const inBounds = (label: string, from: number, to: number): boolean => {
    if (from < 0 || to >= n || from > to) {
      errors.push(`bar ${bi}: ${label} range [${from}, ${to}] is out of bounds`);
      return false;
    }
    return true;
  };

  const beams = bar.beams ?? [];
  beams.forEach(([from, to], k) => {
    if (!inBounds(`beams[${k}]`, from, to)) return;
    for (let i = from; i <= to; i++) {
      const item = bar.items[i]!;
      if (item.kind === "rest" || !BEAMABLE.has(item.duration)) {
        errors.push(`bar ${bi}: beams[${k}] includes a non-beamable item at index ${i}`);
      }
    }
  });
  errors.push(...noOverlap(beams, `bar ${bi}: beams`));

  const tuplets = bar.tuplets ?? [];
  tuplets.forEach((t, k) => {
    if (!inBounds(`tuplets[${k}]`, t.from, t.to)) return;
    if (!Number.isInteger(t.num) || t.num <= 0 || !Number.isInteger(t.den) || t.den <= 0) {
      errors.push(`bar ${bi}: tuplets[${k}] num/den must be positive integers`);
    }
  });
  errors.push(
    ...noOverlap(
      tuplets.map((t): [number, number] => [t.from, t.to]),
      `bar ${bi}: tuplets`,
    ),
  );

  return errors;
}

/**
 * 同種の範囲同士が重ならないことを確認する。
 * beams と tuplets の相互の重なりは検査しない（連符の8分音符は連桁もされるため）。
 */
function noOverlap(ranges: Array<[number, number]>, label: string): string[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]![0] <= sorted[i - 1]![1]) return [`${label}: ranges overlap`];
  }
  return [];
}
