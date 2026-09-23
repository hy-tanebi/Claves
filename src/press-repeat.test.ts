import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPressRepeat } from "./press-repeat";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createPressRepeat", () => {
  it("押した瞬間に1回動く", () => {
    const onStep = vi.fn(() => true);
    createPressRepeat(onStep).start();
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it("押し続けると 400ms で連続を始め、以後 80ms ごとに動く", () => {
    const onStep = vi.fn(() => true);
    createPressRepeat(onStep).start();

    vi.advanceTimersByTime(399);
    expect(onStep).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1); // 400ms
    expect(onStep).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(79); // 479ms
    expect(onStep).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1); // 480ms
    expect(onStep).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(80); // 560ms
    expect(onStep).toHaveBeenCalledTimes(4);
  });

  it("連続の最中に離すと止まる", () => {
    const onStep = vi.fn(() => true);
    const repeat = createPressRepeat(onStep);
    repeat.start();
    vi.advanceTimersByTime(480);
    expect(onStep).toHaveBeenCalledTimes(3);

    repeat.stop();
    vi.advanceTimersByTime(1000);
    expect(onStep).toHaveBeenCalledTimes(3);
  });

  it("連続が始まる前に離すと、1回だけで終わる", () => {
    const onStep = vi.fn(() => true);
    const repeat = createPressRepeat(onStep);
    repeat.start();
    vi.advanceTimersByTime(200);
    repeat.stop();
    vi.advanceTimersByTime(1000);
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it("onStep が false を返したら（上限・下限に着いたら）それ以上動かない", () => {
    // 3回目で上限に着いた、という想定
    let calls = 0;
    const onStep = vi.fn(() => ++calls < 3);
    createPressRepeat(onStep).start();
    vi.advanceTimersByTime(2000);
    expect(onStep).toHaveBeenCalledTimes(3);
  });

  it("連続の最中に start し直しても、繰り返しが二重にならない", () => {
    // pointerup を取りこぼしたまま次の pointerdown が来た場合など
    const onStep = vi.fn(() => true);
    const repeat = createPressRepeat(onStep);
    repeat.start();
    vi.advanceTimersByTime(480); // 3回
    repeat.start(); // 4回（押し直しの1回）
    expect(onStep).toHaveBeenCalledTimes(4);

    // 押し直しから数え直す。前の繰り返しが残っていれば、ここで増える
    vi.advanceTimersByTime(399);
    expect(onStep).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(1); // 押し直しから 400ms
    expect(onStep).toHaveBeenCalledTimes(5);
  });
});
