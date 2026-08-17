import type { AudioClock, ScheduleRequest, ScheduledSound } from "./clock";

export type ScheduleRecord = ScheduleRequest & {
  /** 予約した瞬間の now()。time < scheduledAt なら「過去への予約」 */
  scheduledAt: number;
  cancelled: boolean;
  fired: boolean;
};

/**
 * テスト用の時計。実 Web Audio の制約を再現する。
 *
 *   1. 発音済みの音は cancel() できない（鳴った鐘は戻せない）
 *   2. 過去への予約は即座に鳴る（start(when) の when が過去だと即時発音される）
 *   3. 時計は逆行しない
 *
 * これを再現しないと、テストが通っても実機の正しさを保証できない。
 */
export class FakeClock implements AudioClock {
  private current = 0;
  readonly records: ScheduleRecord[] = [];

  now(): number {
    return this.current;
  }

  advanceTo(t: number): void {
    if (t < this.current) {
      throw new Error(`clock cannot go backwards: ${this.current} -> ${t}`);
    }
    this.current = t;
    for (const r of this.records) {
      if (!r.cancelled && !r.fired && r.time <= this.current) r.fired = true;
    }
  }

  schedule(req: ScheduleRequest): ScheduledSound {
    const rec: ScheduleRecord = {
      ...req,
      scheduledAt: this.current,
      cancelled: false,
      // 過去への予約は実 Web Audio では即座に鳴る
      fired: req.time <= this.current,
    };
    this.records.push(rec);
    return {
      time: req.time,
      cancel() {
        if (rec.fired) return; // 発音済みは取り消せない
        rec.cancelled = true;
      },
    };
  }

  /** 実際に鳴った予約 */
  get fired(): ScheduleRecord[] {
    return this.records.filter((r) => r.fired);
  }

  /** これから鳴る予定の予約 */
  get pending(): ScheduleRecord[] {
    return this.records.filter((r) => !r.fired && !r.cancelled);
  }

  /** 過去に予約されてしまったもの（実機なら即座に連射される） */
  get lateSchedules(): ScheduleRecord[] {
    return this.records.filter((r) => r.time < r.scheduledAt);
  }

  private get firedInOrder(): ScheduleRecord[] {
    return this.fired.slice().sort((a, b) => a.time - b.time);
  }

  get firedTimes(): number[] {
    return this.firedInOrder.map((r) => r.time);
  }

  /** 鳴った音の絶対 tick（世代をまたいでも同じ打点は同じ値になる） */
  get firedTicks(): number[] {
    return this.firedInOrder.map((r) => r.absTick);
  }

  /** 論理イベントキー（generation:absTick:noteId） */
  get firedKeys(): string[] {
    return this.firedInOrder.map((r) => `${r.generation}:${r.absTick}:${r.noteId}`);
  }
}
