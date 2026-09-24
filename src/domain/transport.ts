import type { Pitch } from "./types";

/**
 * 再生計画。**JS と Swift が共有する唯一の契約。**
 *
 * iOS ではバックグラウンドで WKWebView ごと止まるため、再生クロックは
 * ネイティブが所有する。JS はユーザー操作を「この計画に切り替えてくれ」という
 * 宣言に変換して渡すだけで、時刻の計算は両側が同じ式で行う。
 *
 * その「同じ式」がこのファイル。golden fixture（`golden/transport.json`）を
 * 書き出して Swift 側に同じ入出力テストを掛けるので、
 * **ここを変えたら fixture も作り直す**（テストが検出する）。
 */
export type TransportPlan = {
  schemaVersion: 1;
  /** 4分音符の tick 数。このアプリでは常に 96 */
  ppq: 96;
  /** BPM の1拍が何 tick か。2/4・4/4 は 96、2/2 は 192、6/8 は 144 */
  bpmUnit: number;
  /** 1周期の tick 数 */
  cycleTicks: number;
  bpm: number;
  /** この計画の基準点（絶対 tick） */
  originTick: number;
  /** 基準点の時刻（秒）。オーディオ側の時計で測った値 */
  originSeconds: number;
  /** 周期内の打点。tick は昇順 */
  events: Array<{ tick: number; pitch: Pitch }>;
};

export type TransportEvent = {
  absTick: number;
  seconds: number;
  pitch: Pitch;
};

/**
 * 1 tick の長さ（秒）。
 *
 * **`bpmUnit` を必ず噛ませる。** 拍子を変えたのに据え置くと
 * テンポが倍ずれる（このプロジェクトで実際に踏んだ）。
 */
export function secondsPerTick(plan: Pick<TransportPlan, "bpm" | "bpmUnit">): number {
  return 60 / plan.bpm / plan.bpmUnit;
}

/**
 * 通し番号 index の打点。index は 0 から無限に増える（周期をまたぐ）。
 *
 * 絶対 tick は「何周目か × 周期長 + 周期内の tick」。
 * 時刻は基準点からの tick 差に 1 tick の長さを掛けたもので、
 * **基準点より前の tick なら負の差になる**（切替直後に起こりうる）。
 */
export function eventAt(plan: TransportPlan, index: number): TransportEvent {
  const count = plan.events.length;
  const loop = Math.floor(index / count);
  const ev = plan.events[index % count]!;
  const absTick = loop * plan.cycleTicks + ev.tick;
  return {
    absTick,
    seconds: plan.originSeconds + (absTick - plan.originTick) * secondsPerTick(plan),
    pitch: ev.pitch,
  };
}

/** 絶対 tick の時刻（秒）。基準点より前なら基準時刻より小さくなる */
export function secondsAtTick(plan: TransportPlan, tick: number): number {
  return plan.originSeconds + (tick - plan.originTick) * secondsPerTick(plan);
}

/** 時刻（秒）に対応する絶対 tick。整数に丸めない（境界の判定に使う） */
export function tickAtSeconds(plan: TransportPlan, seconds: number): number {
  return plan.originTick + (seconds - plan.originSeconds) / secondsPerTick(plan);
}
