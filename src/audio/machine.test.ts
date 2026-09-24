import { describe, expect, it } from "vitest";
import { initialContext, transition } from "./machine";
import type { AsyncEvent, MachineContext, MachineEvent, PlaybackState, SyncEvent } from "./machine";

const ASYNC = new Set<string>(["LOAD_OK", "LOAD_FAIL", "RESUME_OK", "RESUME_FAIL", "CLEANUP_DONE"]);

/**
 * 非同期イベントには「その時点の generation」を token として渡す。
 * 実運用の規約（遷移後の generation を読んで返す）と同じ。
 */
const step = (ctx: MachineContext, e: MachineEvent): MachineContext =>
  ASYNC.has(e)
    ? transition(ctx, { event: e as AsyncEvent, token: ctx.generation })
    : transition(ctx, { event: e as SyncEvent });

const run = (events: MachineEvent[], from: MachineContext = initialContext): MachineContext =>
  events.reduce(step, from);

const stateAfter = (events: MachineEvent[]): PlaybackState => run(events).state;

describe("正常系", () => {
  it("idle から再生までたどり着く", () => {
    expect(stateAfter(["INIT"])).toBe("loading");
    expect(stateAfter(["INIT", "LOAD_OK"])).toBe("ready");
    expect(stateAfter(["INIT", "LOAD_OK", "PLAY"])).toBe("starting");
    expect(stateAfter(["INIT", "LOAD_OK", "PLAY", "RESUME_OK"])).toBe("playing");
  });

  it("停止は stopping を経由して ready に戻る", () => {
    expect(stateAfter(["INIT", "LOAD_OK", "PLAY", "RESUME_OK", "STOP"])).toBe("stopping");
    expect(stateAfter(["INIT", "LOAD_OK", "PLAY", "RESUME_OK", "STOP", "CLEANUP_DONE"])).toBe(
      "ready",
    );
  });
});

describe("失敗系はすべて stopping を経由する", () => {
  it("starting での RESUME_FAIL は stopping 経由で audioUnavailable へ行く", () => {
    const ctx = run(["INIT", "LOAD_OK", "PLAY", "RESUME_FAIL"]);
    expect(ctx.state).toBe("stopping");
    expect(ctx.exitTo).toBe("audioUnavailable");
    expect(step(ctx, "CLEANUP_DONE").state).toBe("audioUnavailable");
  });

  it("playing での SESSION_FAIL も stopping 経由で audioUnavailable へ行く", () => {
    const ctx = run(["INIT", "LOAD_OK", "PLAY", "RESUME_OK", "SESSION_FAIL"]);
    expect(ctx.state).toBe("stopping");
    expect(ctx.exitTo).toBe("audioUnavailable");
  });

  it("音源のロード失敗は error になる", () => {
    expect(stateAfter(["INIT", "LOAD_FAIL"])).toBe("error");
  });
});

describe("中断系は stopping 経由で ready に戻り、自動再開しない", () => {
  const reasons: MachineEvent[] = ["INTERRUPT", "BACKGROUND", "ROUTE_LOST", "SUSPENDED"];

  for (const reason of reasons) {
    it(`${reason} で停止し、理由が記録される`, () => {
      const ctx = run(["INIT", "LOAD_OK", "PLAY", "RESUME_OK", reason]);
      expect(ctx.state).toBe("stopping");
      expect(ctx.exitTo).toBe("ready");
      expect(ctx.lastStopReason).toBe(reason);
      expect(step(ctx, "CLEANUP_DONE").state).toBe("ready");
    });
  }

  it("次の再生開始で lastStopReason がクリアされる", () => {
    const stopped = run(["INIT", "LOAD_OK", "PLAY", "RESUME_OK", "ROUTE_LOST", "CLEANUP_DONE"]);
    expect(stopped.lastStopReason).toBe("ROUTE_LOST");

    const restarted = step(stopped, "PLAY");
    expect(restarted.state).toBe("starting");
    expect(restarted.lastStopReason).toBeNull();
  });

  it("audioUnavailable からの再試行でも lastStopReason がクリアされる", () => {
    const unavailable = run(["INIT", "LOAD_OK", "PLAY", "RESUME_FAIL", "CLEANUP_DONE"]);
    expect(unavailable.state).toBe("audioUnavailable");
    expect(step(unavailable, "RETRY").lastStopReason).toBeNull();
  });
});

describe("競合と連打", () => {
  it("playing 中の PLAY は無視される", () => {
    const before = run(["INIT", "LOAD_OK", "PLAY", "RESUME_OK"]);
    expect(step(before, "PLAY")).toEqual(before);
  });

  it("stopping 中の PLAY / STOP は無視される", () => {
    const stopping = run(["INIT", "LOAD_OK", "PLAY", "RESUME_OK", "STOP"]);
    expect(step(stopping, "PLAY")).toEqual(stopping);
    expect(step(stopping, "STOP")).toEqual(stopping);
  });

  it("stopping 中に別の停止理由が来ても exitTo は上書きされない", () => {
    const stopping = run(["INIT", "LOAD_OK", "PLAY", "RESUME_OK", "SESSION_FAIL"]);
    const after = step(stopping, "INTERRUPT");
    expect(after.exitTo).toBe("audioUnavailable");
    expect(after.lastStopReason).toBe("SESSION_FAIL");
  });

  it("loading 中の PLAY / STOP / 中断は無視される", () => {
    const loading = run(["INIT"]);
    for (const e of ["PLAY", "STOP", "INTERRUPT", "BACKGROUND", "ROUTE_LOST"] as MachineEvent[]) {
      expect(step(loading, e)).toEqual(loading);
    }
  });

  it("ready 中の中断イベントは無視される（すでに停止状態）", () => {
    const ready = run(["INIT", "LOAD_OK"]);
    for (const e of ["INTERRUPT", "BACKGROUND", "ROUTE_LOST", "SUSPENDED"] as MachineEvent[]) {
      expect(step(ready, e)).toEqual(ready);
    }
  });
});

describe("世代トークンによる古いコールバックの無視", () => {
  it("古い token を持つ RESUME_OK は無視される", () => {
    const starting = run(["INIT", "LOAD_OK", "PLAY"]);
    const stale = starting.generation - 1;
    expect(transition(starting, { event: "RESUME_OK", token: stale })).toEqual(starting);
    expect(transition(starting, { event: "RESUME_OK", token: starting.generation }).state).toBe(
      "playing",
    );
  });

  it("古い token を持つ LOAD_OK は無視される", () => {
    const loading = run(["INIT", "LOAD_FAIL", "RETRY"]); // 再試行で generation が進む
    const stale = loading.generation - 1;
    expect(transition(loading, { event: "LOAD_OK", token: stale })).toEqual(loading);
    expect(transition(loading, { event: "LOAD_OK", token: loading.generation }).state).toBe("ready");
  });

  it("古い token を持つ CLEANUP_DONE は無視される", () => {
    const stopping = run(["INIT", "LOAD_OK", "PLAY", "RESUME_OK", "STOP"]);
    const stale = stopping.generation - 1;
    expect(transition(stopping, { event: "CLEANUP_DONE", token: stale })).toEqual(stopping);
  });

  it("規約どおり『遷移後の generation』を返せば CLEANUP_DONE が通る", () => {
    const playing = run(["INIT", "LOAD_OK", "PLAY", "RESUME_OK"]);
    const stopping = transition(playing, { event: "STOP" });
    // cleanup を始める側は「遷移後の generation」を読む
    const tokenForCleanup = stopping.generation;
    expect(transition(stopping, { event: "CLEANUP_DONE", token: tokenForCleanup }).state).toBe(
      "ready",
    );
  });
});

describe("generation", () => {
  it("音源ロードの開始で進む", () => {
    expect(run(["INIT"]).generation).toBe(initialContext.generation + 1);
  });

  it("再生開始で進む", () => {
    const ready = run(["INIT", "LOAD_OK"]);
    expect(step(ready, "PLAY").generation).toBe(ready.generation + 1);
  });

  it("error からの RETRY で進む", () => {
    const err = run(["INIT", "LOAD_FAIL"]);
    const retried = step(err, "RETRY");
    expect(retried.state).toBe("loading");
    expect(retried.generation).toBe(err.generation + 1);
  });

  it("audioUnavailable からの RETRY で進む", () => {
    const unavailable = run(["INIT", "LOAD_OK", "PLAY", "RESUME_FAIL", "CLEANUP_DONE"]);
    const retried = step(unavailable, "RETRY");
    expect(retried.state).toBe("starting");
    expect(retried.generation).toBe(unavailable.generation + 1);
  });

  it("停止で進む", () => {
    const playing = run(["INIT", "LOAD_OK", "PLAY", "RESUME_OK"]);
    expect(step(playing, "STOP").generation).toBe(playing.generation + 1);
  });
});

describe("未定義の組み合わせ", () => {
  it("error 状態では RETRY 以外のすべてを無視する", () => {
    const err = run(["INIT", "LOAD_FAIL"]);
    for (const e of ["PLAY", "STOP", "RESUME_OK", "INTERRUPT", "CLEANUP_DONE"] as MachineEvent[]) {
      expect(step(err, e)).toEqual(err);
    }
  });
});
