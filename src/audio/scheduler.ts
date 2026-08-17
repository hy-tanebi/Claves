import { toPlaybackEvents } from "../domain/derive";
import { secPerTick, totalTicks } from "../domain/ticks";
import { validatePattern } from "../domain/validate";
import type { Pattern, PlaybackEvent } from "../domain/types";
import type { AudioClock, ScheduledSound } from "./clock";

/**
 * 先読み窓（秒）。iOS の WebView では GC やレイアウトでメインスレッドが
 * 200ms 以上止まり得るため、200ms では保証にならない。
 */
export const LOOKAHEAD_SEC = 0.5;

export const MIN_BPM = 40;
export const MAX_BPM = 240;

export type HighlightEntry = {
  generation: number;
  time: number;
  noteId: string;
};

type Entry = {
  time: number;
  sound: ScheduledSound;
};

/**
 * 保留中の切替。次の拍境界（atTick）から効かせる。
 * 「予約済みの音より後の拍境界」にしか置かないので、
 * 予約を取り消す必要が一切ない。
 */
type PendingChange =
  | { kind: "tempo"; bpm: number; atTick: number }
  | { kind: "pattern"; pattern: Pattern; bpm: number; atTick: number };

function assertBpm(bpm: number): void {
  if (!Number.isInteger(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) {
    throw new RangeError(`bpm must be an integer in [${MIN_BPM}, ${MAX_BPM}], got ${bpm}`);
  }
}

function assertPattern(p: Pattern): void {
  const errors = validatePattern(p);
  if (errors.length > 0) {
    throw new Error(`invalid pattern "${p.id}": ${errors.join("; ")}`);
  }
}

/**
 * 先読みスケジューラ。
 *
 * タイマー（pump）は「予約する係」に徹し、発音はオーディオ側の時計に任せる。
 * テンポ変更とパターン変更は次の拍境界から効かせるため、
 * 予約済みの音を取り消す必要がなく、二重発音も打点欠落も構造的に起こらない。
 */
export class Scheduler {
  private generation = 0;
  private events: PlaybackEvent[] = [];
  private total = 0;
  private bpmUnit = 0;
  private spt = 0;
  /** 基準点。切替のたびにここを打ち直す */
  private tickOrigin = 0;
  private timeOrigin = 0;
  /** 次に予約するイベントのグローバル通し番号 */
  private nextIndex = 0;
  /** 最後に予約した打点の絶対 tick。切替点はこれより後にしか置けない */
  private lastScheduledTick = -1;
  private entries: Entry[] = [];
  private highlights: HighlightEntry[] = [];
  private pending: PendingChange | null = null;
  private dropped = 0;
  private running = false;

  constructor(private readonly clock: AudioClock) {}

  get currentGeneration(): number {
    return this.generation;
  }

  get isPlaying(): boolean {
    return this.running;
  }

  /** 遅れて読み飛ばした打点の累計（デバッグ用） */
  get droppedCount(): number {
    return this.dropped;
  }

  /** まだ発音していない予約の件数 */
  get pendingCount(): number {
    return this.entries.length;
  }

  /** 保留中の切替が効き始める絶対 tick。なければ null */
  get pendingSwitchTick(): number | null {
    return this.pending?.atTick ?? null;
  }

  /** 再生開始。常に tick 0 から */
  start(pattern: Pattern, bpm: number, startTime: number): void {
    assertBpm(bpm);
    assertPattern(pattern);

    // 再生中に呼ばれても安全なように、まず既存の予約とハイライトを捨てる
    this.cancelAll();
    this.highlights = [];
    this.pending = null;

    this.generation++;
    this.events = toPlaybackEvents(pattern);
    this.total = totalTicks(pattern);
    this.bpmUnit = pattern.bpmUnit;
    this.spt = secPerTick(pattern, bpm);
    this.tickOrigin = 0;
    this.timeOrigin = startTime;
    this.nextIndex = 0;
    this.lastScheduledTick = -1;
    this.dropped = 0;
    this.running = true;

    this.pump();
  }

  /** すべての予約を取り消して停止する */
  stop(): void {
    this.cancelAll();
    this.generation++;
    this.events = [];
    this.highlights = [];
    this.pending = null;
    this.running = false;
  }

  /**
   * テンポ変更を予約する。次の拍境界から効く。
   * 予約済みの音より後の境界にしか置かないので、取り消しは発生しない。
   */
  requestTempoChange(bpm: number): void {
    assertBpm(bpm);
    this.assertRunning();
    this.pending = { kind: "tempo", bpm, atTick: this.nextBoundaryTick() };
  }

  /**
   * パターン変更を予約する。次の拍境界から、新パターンの先頭で鳴り始める。
   */
  requestPatternChange(pattern: Pattern, bpm: number): void {
    assertBpm(bpm);
    assertPattern(pattern);
    this.assertRunning();
    this.pending = { kind: "pattern", pattern, bpm, atTick: this.nextBoundaryTick() };
  }

  /** 先読み窓に入ったイベントを予約する。25ms ごとに呼ぶ */
  pump(): void {
    if (!this.running || this.events.length === 0) return;
    const now = this.clock.now();

    // 遅れたイベントは予約せずに読み飛ばし、次の未来イベントに追いつく。
    // 過去の start(when) は実機で即座に鳴り、打点が連射されるため。
    while (this.timeOf(this.nextIndex) < now) {
      this.dropped++;
      this.nextIndex++;
    }

    const limit = now + LOOKAHEAD_SEC;
    while (this.timeOf(this.nextIndex) < limit) {
      if (this.pending && this.absTickOf(this.nextIndex) >= this.pending.atTick) {
        this.applyPending(now);
        continue; // 新しい基準で同じ位置を再評価する
      }
      this.scheduleAt(this.nextIndex);
      this.nextIndex++;
    }

    this.prune(now);
  }

  /**
   * time までに到来したハイライトを取り出す（取り出した分はキューから消える）。
   * UI は requestAnimationFrame のループからこれを呼ぶ。
   */
  drainHighlightsUpTo(time: number): HighlightEntry[] {
    const due = this.highlights.filter((h) => h.time <= time);
    this.highlights = this.highlights.filter((h) => h.time > time);
    return due;
  }

  private assertRunning(): void {
    if (!this.running) {
      throw new Error("scheduler is not playing; call start() first");
    }
  }

  /**
   * 切替を置ける最初の拍境界。
   * すでに予約した打点より後で、かつ現在時刻以降でなければならない。
   */
  private nextBoundaryTick(): number {
    const nowTick = this.tickAtTime(this.clock.now());
    const floor = Math.max(this.lastScheduledTick, nowTick);
    let boundary = Math.ceil(floor / this.bpmUnit) * this.bpmUnit;
    // 予約済みの打点と同じ位置では切り替えられない（二重発音になる）
    while (boundary <= this.lastScheduledTick) boundary += this.bpmUnit;
    return boundary;
  }

  private applyPending(now: number): void {
    const p = this.pending!;
    let atTick = p.atTick;
    let switchTime = this.timeOfTick(atTick);

    if (switchTime < now) {
      // 長いフリーズなどで切替点を過ぎた場合、現在時刻以降の拍境界に置き直す
      const nowTick = this.tickAtTime(now);
      atTick = Math.ceil(nowTick / this.bpmUnit) * this.bpmUnit;
      switchTime = this.timeOfTick(atTick);
    }

    this.generation++;

    if (p.kind === "pattern") {
      this.events = toPlaybackEvents(p.pattern);
      this.total = totalTicks(p.pattern);
      this.bpmUnit = p.pattern.bpmUnit;
      this.tickOrigin = 0;
      this.nextIndex = 0;
    } else {
      this.tickOrigin = atTick;
    }

    this.spt = 60 / p.bpm / this.bpmUnit;
    this.timeOrigin = switchTime;
    this.pending = null;
  }

  private cancelAll(): void {
    for (const e of this.entries) e.sound.cancel();
    this.entries = [];
  }

  /** 発音済みの予約への参照を解放する（長時間再生でのメモリ増加を防ぐ） */
  private prune(now: number): void {
    this.entries = this.entries.filter((e) => e.time > now);
  }

  /** グローバル通し番号 index の絶対 tick */
  private absTickOf(index: number): number {
    const loop = Math.floor(index / this.events.length);
    return loop * this.total + this.events[index % this.events.length]!.tick;
  }

  /** グローバル通し番号 index の発音時刻 */
  private timeOf(index: number): number {
    return this.timeOfTick(this.absTickOf(index));
  }

  private timeOfTick(tick: number): number {
    return this.timeOrigin + (tick - this.tickOrigin) * this.spt;
  }

  private tickAtTime(time: number): number {
    return this.tickOrigin + (time - this.timeOrigin) / this.spt;
  }

  private scheduleAt(index: number): void {
    const ev = this.events[index % this.events.length]!;
    const absTick = this.absTickOf(index);
    const time = this.timeOf(index);

    const sound = this.clock.schedule({
      time,
      pitch: ev.pitch,
      noteId: ev.noteId,
      absTick,
      generation: this.generation,
    });

    this.entries.push({ time, sound });
    this.highlights.push({ generation: this.generation, time, noteId: ev.noteId });
    this.lastScheduledTick = absTick;
  }
}
