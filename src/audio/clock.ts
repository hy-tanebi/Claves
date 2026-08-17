import type { Pitch } from "../domain/types";

/**
 * 予約1件。
 * time と pitch は発音に必要。
 * noteId / absTick / generation は論理的な同一性を表し、デバッグと検証に使う。
 */
export type ScheduleRequest = {
  time: number;
  pitch: Pitch;
  noteId: string;
  absTick: number;
  generation: number;
};

export interface ScheduledSound {
  readonly time: number;
  /** まだ発音していなければ取り消す。発音済みなら何も起きない */
  cancel(): void;
}

export interface AudioClock {
  /** 現在時刻（秒）。AudioContext.currentTime 相当 */
  now(): number;
  schedule(req: ScheduleRequest): ScheduledSound;
}
