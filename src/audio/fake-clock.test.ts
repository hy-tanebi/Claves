import { describe, expect, it } from "vitest";
import { FakeClock } from "./fake-clock";
import type { ScheduleRequest } from "./clock";

const req = (
  time: number,
  over: Partial<Pick<ScheduleRequest, "noteId" | "absTick" | "generation">> = {},
): ScheduleRequest => ({
  time,
  pitch: "high",
  noteId: over.noteId ?? "n",
  absTick: over.absTick ?? 0,
  generation: over.generation ?? 1,
});

describe("FakeClock", () => {
  it("未来の予約はまだ鳴っていない", () => {
    const c = new FakeClock();
    c.schedule(req(1.0));
    expect(c.fired).toHaveLength(0);
    expect(c.pending).toHaveLength(1);
  });

  it("時計を進めると到来した予約が発音済みになる", () => {
    const c = new FakeClock();
    c.schedule(req(1.0));
    c.advanceTo(1.0);
    expect(c.firedTimes).toEqual([1.0]);
    expect(c.pending).toHaveLength(0);
  });

  it("発音済みの音は cancel できない", () => {
    const c = new FakeClock();
    const s = c.schedule(req(1.0));
    c.advanceTo(1.0);
    s.cancel();
    expect(c.firedTimes).toEqual([1.0]);
  });

  it("まだ鳴っていない音は cancel できる", () => {
    const c = new FakeClock();
    const s = c.schedule(req(1.0));
    c.advanceTo(0.9);
    s.cancel();
    c.advanceTo(2.0);
    expect(c.fired).toHaveLength(0);
  });

  it("過去への予約は即座に発音済みになり、lateSchedules にも残る", () => {
    const c = new FakeClock();
    c.advanceTo(1.0);
    const s = c.schedule(req(0.5));
    expect(c.firedTimes).toEqual([0.5]);
    expect(c.lateSchedules).toHaveLength(1);
    s.cancel();
    expect(c.fired).toHaveLength(1); // 取り消せない
  });

  it("時計は逆行できない", () => {
    const c = new FakeClock();
    c.advanceTo(1.0);
    expect(() => c.advanceTo(0.9)).toThrow();
  });

  it("論理キーと絶対 tick を取り出せる", () => {
    const c = new FakeClock();
    c.schedule(req(0.5, { noteId: "a", absTick: 144, generation: 2 }));
    c.advanceTo(0.5);
    expect(c.firedKeys).toEqual(["2:144:a"]);
    expect(c.firedTicks).toEqual([144]);
  });
});
