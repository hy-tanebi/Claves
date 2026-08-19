import { Formatter, Stave, StaveNote, Voice } from "vexflow";
import type { Bar, NotationItem, Pattern, Pitch } from "../domain/types";

/**
 * 打楽器譜の音高位置。
 * アゴゴ／カウベルの高音・低音を五線上の2つの位置に描き分ける。
 */
export const STAFF_POSITION: Record<Pitch, string> = {
  high: "c/5",
  low: "f/4",
};

/** 休符は五線の中央に置く */
export const REST_POSITION = "b/4";

/**
 * レイアウトの定数（すべてユーザー単位）。
 *
 * `systemWidth` は**すべてのパターンで固定**する。
 * パターンごとに自然幅で描くと、音符の少ないリズムは巨大に、
 * 密なリズムは極小になり、切り替えたときに譜面の大きさが揃わない。
 * 幅を固定し、収まらないパターンは段を増やすことで大きさを揃える。
 *
 * 560 という値は実ブラウザ（iPhone 相当 390px 幅）での計測で決めた。
 * このとき五線の高さは約 25.6px になり、見本の the Clave と同等になる。
 *
 * なお Samba Reggae が必要とする幅は 249 単位（フォント読み込み後の実測）。
 * 560 はそれより広く、音符は小節いっぱいに均等に配分される。
 * 幅を狭めれば音符は大きくなるが、五線も一緒に大きくなる。
 */
export const LAYOUT = {
  systemWidth: 560,
  systemHeight: 92,
  staveTop: 20,
  sidePadding: 6,
  /** 小節内で音符に使える最小の幅。これを下回る配分はしない */
  minNoteArea: 40,
  /** 小節の末尾に残す余白。休符が小節線に貼り付くのを防ぐ */
  barTailPadding: 14,
} as const;

/** 1pt = 4/3 ユーザー単位 */
export const PT_TO_UNIT = 4 / 3;

/**
 * NotationItem を VexFlow の音価文字列にする。
 *
 * 形式は「音価 + 付点(d) + 種別(r)」。
 * **付点は必ずこの文字列に含める。** Dot モディファイアを後付けするだけでは
 * VexFlow が音価を付点なしとして数え、小節の長さが合わずに
 * IncompleteVoice で落ちる。
 */
export function durationOf(item: NotationItem): string {
  const dot = item.dots === 1 ? "d" : "";
  const rest = item.kind === "rest" ? "r" : "";
  return `${item.duration}${dot}${rest}`;
}

export function buildNote(item: NotationItem): StaveNote {
  const key = item.kind === "rest" ? REST_POSITION : STAFF_POSITION[item.pitch];
  return new StaveNote({
    keys: [key],
    duration: durationOf(item),
    // 打楽器譜なので符尾の向きは上に揃える（読みやすさ優先）
    stemDirection: 1,
  });
}

export function buildVoice(bar: Bar, pattern: Pattern): { voice: Voice; notes: StaveNote[] } {
  const notes = bar.items.map(buildNote);
  const voice = new Voice({
    numBeats: pattern.meter.beats,
    beatValue: pattern.meter.beatUnit,
  });
  voice.setStrict(true);
  voice.addTickables(notes);
  return { voice, notes };
}

/**
 * 拍子記号が占める幅を VexFlow に測ってもらう。
 * 定数で決め打つと、拍子が変わったときにずれる。
 */
export function measureTimeSignatureWidth(pattern: Pattern): number {
  const stave = new Stave(0, 0, 200);
  stave.addTimeSignature(`${pattern.meter.beats}/${pattern.meter.beatUnit}`);
  return stave.getNoteStartX() - stave.getX();
}

/**
 * 各小節を組むのに最低限必要な幅を VexFlow に測ってもらう。
 *
 * `preCalculateMinTotalWidth()` は不揃いな音価に対する余裕を上乗せして返すが、
 * 実際の描画では小節ごとに幅を与えて詰めるため、そこまでは要らない。
 * 上乗せ前の値（`getMinTotalWidth()`）を段組みの判定に使い、
 * 上乗せ後の値は小節間の幅の配分比に使う。
 */
export type BarWidth = {
  /** 段に収まるかの判定に使う（上乗せなし） */
  hard: number;
  /** 小節間で幅を配分する比率に使う（上乗せあり） */
  weight: number;
};

export function measureBars(pattern: Pattern): BarWidth[] {
  return pattern.bars.map((bar) => {
    const { voice } = buildVoice(bar, pattern);
    const formatter = new Formatter().joinVoices([voice]);
    const weight = formatter.preCalculateMinTotalWidth([voice]);
    return { hard: formatter.getMinTotalWidth(), weight };
  });
}

export type SystemPlan = {
  /** この段に載せる小節の添字 */
  barIndices: number[];
  /** 小節の添字 → 割り当てる幅 */
  widths: number[];
};

/**
 * 小節を段に振り分け、各小節の幅を決める。
 *
 * 段の幅は固定なので、収まらない小節は次の段へ送る。
 * 段内の幅は各小節の必要量の比で配分する（均等割りにすると、
 * 音符の多い小節が詰まり、少ない小節が間延びする）。
 */
export function planSystems(pattern: Pattern, timeSigWidth: number): SystemPlan[] {
  const bars = measureBars(pattern);
  const systems: SystemPlan[] = [];

  let current: number[] = [];
  let used = 0;

  const availableFor = (isFirstSystem: boolean) =>
    LAYOUT.systemWidth - LAYOUT.sidePadding * 2 - (isFirstSystem ? timeSigWidth : 0);

  bars.forEach((bar, i) => {
    const available = availableFor(systems.length === 0);
    if (current.length > 0 && used + bar.hard > available) {
      systems.push({ barIndices: current, widths: [] });
      current = [];
      used = 0;
    }
    current.push(i);
    used += bar.hard;
  });
  if (current.length > 0) systems.push({ barIndices: current, widths: [] });

  // 段ごとに、必要量の比で幅を配分する
  systems.forEach((system, si) => {
    const available = availableFor(si === 0);
    const weights = system.barIndices.map((i) => bars[i]!.weight);
    const total = weights.reduce((a, b) => a + b, 0);
    system.widths = weights.map((w) => Math.max(LAYOUT.minNoteArea, (available * w) / total));
  });

  return systems;
}
