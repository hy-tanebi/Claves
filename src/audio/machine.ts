export type PlaybackState =
  | "idle"
  | "loading"
  | "ready"
  | "starting"
  | "playing"
  | "stopping"
  | "error"
  | "audioUnavailable";

/** ユーザー操作と OS からの通知。token を持たない */
export type SyncEvent =
  | "INIT"
  | "PLAY"
  | "STOP"
  | "RETRY"
  | "INTERRUPT"
  | "BACKGROUND"
  | "ROUTE_LOST"
  | "SUSPENDED"
  | "SESSION_FAIL";

/** 非同期処理の結果。開始時の generation を token として必ず返す */
export type AsyncEvent = "LOAD_OK" | "LOAD_FAIL" | "RESUME_OK" | "RESUME_FAIL" | "CLEANUP_DONE";

export type MachineEvent = SyncEvent | AsyncEvent;

/**
 * 非同期イベントには token を必須にする。
 * これで「渡し忘れて古いコールバックが通る」ことを型で防ぐ。
 */
export type MachineInput = { event: SyncEvent } | { event: AsyncEvent; token: number };

export type StopReason = Extract<
  MachineEvent,
  "STOP" | "INTERRUPT" | "BACKGROUND" | "ROUTE_LOST" | "SUSPENDED" | "RESUME_FAIL" | "SESSION_FAIL"
>;

export type ExitTo = Extract<PlaybackState, "ready" | "audioUnavailable">;

export type MachineContext = {
  state: PlaybackState;
  /** 非同期処理を新たに開始するたびに進める。古いコールバックを無効化するため */
  generation: number;
  /** stopping に入るときに1度だけ決まる出口。上書きしない */
  exitTo: ExitTo;
  /** 直近で停止した理由。UI の表示にのみ使う。次の再生開始でクリアする */
  lastStopReason: StopReason | null;
};

export const initialContext: MachineContext = {
  state: "idle",
  generation: 0,
  exitTo: "ready",
  lastStopReason: null,
};

/** 音を出せない状態に落ちる失敗 */
const FAIL_EVENTS = new Set<MachineEvent>(["RESUME_FAIL", "SESSION_FAIL"]);

/** 単に停止する理由 */
const STOP_EVENTS = new Set<MachineEvent>([
  "STOP",
  "INTERRUPT",
  "BACKGROUND",
  "ROUTE_LOST",
  "SUSPENDED",
]);

/**
 * 状態遷移。表にない（状態, イベント）の組み合わせは
 * すべて無視して同じコンテキストを返す。
 *
 * 非同期イベントの token が現在の generation と一致しなければ、
 * 「古いコールバック」として無視する。
 *
 * CLEANUP_DONE の規約: stopping に入る遷移で generation が進むので、
 * cleanup を開始する側は「遷移した後の generation」を読んで token に使う。
 * 遷移前の値を握って返すと、正しい完了通知まで捨てられ、
 * stopping から抜けられなくなる。
 */
export function transition(ctx: MachineContext, input: MachineInput): MachineContext {
  if ("token" in input && input.token !== ctx.generation) return ctx;
  const event = input.event;

  switch (ctx.state) {
    case "idle":
      if (event === "INIT") return { ...ctx, state: "loading", generation: ctx.generation + 1 };
      return ctx;

    case "loading":
      if (event === "LOAD_OK") return { ...ctx, state: "ready" };
      if (event === "LOAD_FAIL") return { ...ctx, state: "error" };
      return ctx;

    case "ready":
      if (event === "PLAY") return startPlayback(ctx);
      return ctx;

    case "starting":
      if (event === "RESUME_OK") return { ...ctx, state: "playing" };
      if (FAIL_EVENTS.has(event)) return enterStopping(ctx, event, "audioUnavailable");
      if (STOP_EVENTS.has(event)) return enterStopping(ctx, event, "ready");
      return ctx;

    case "playing":
      if (event === "SESSION_FAIL") return enterStopping(ctx, event, "audioUnavailable");
      if (STOP_EVENTS.has(event)) return enterStopping(ctx, event, "ready");
      return ctx;

    case "stopping":
      // exitTo と lastStopReason は上書きしない（最初の理由を保持する）
      if (event === "CLEANUP_DONE") return { ...ctx, state: ctx.exitTo };
      return ctx;

    case "error":
      if (event === "RETRY") return { ...ctx, state: "loading", generation: ctx.generation + 1 };
      return ctx;

    case "audioUnavailable":
      if (event === "RETRY") return startPlayback(ctx);
      return ctx;
  }
}

/** 再生を開始する。古い停止理由をクリアし、世代を進める */
function startPlayback(ctx: MachineContext): MachineContext {
  return {
    ...ctx,
    state: "starting",
    generation: ctx.generation + 1,
    lastStopReason: null,
  };
}

function enterStopping(ctx: MachineContext, event: MachineEvent, exitTo: ExitTo): MachineContext {
  return {
    state: "stopping",
    generation: ctx.generation + 1,
    exitTo,
    lastStopReason: event as StopReason,
  };
}
