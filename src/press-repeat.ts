/**
 * 押し続けると繰り返す操作（テンポの ± ボタン）。
 *
 * 押した瞬間に1回動き、押し続けると REPEAT_DELAY_MS 後から
 * REPEAT_INTERVAL_MS ごとに動く。DOM もテンポも知らず、時間の振る舞いだけを持つ。
 *
 * **加速はしない。** 大きく動かすのはスライダーの役目で、± は「あと数 BPM」のためのもの。
 * 加速すると狙った値を通り過ぎる。
 */

/** 1回押しと長押しを分ける待ち時間。短いと、1回押したつもりで2つ動く */
export const REPEAT_DELAY_MS = 400;

/** 連続中の間隔。1秒に約12。40→240 の端から端は20秒かかるが、そこはスライダーで動かす */
export const REPEAT_INTERVAL_MS = 80;

/**
 * @param onStep 1段階動かす。動けなかった（上限・下限に着いた）ら false を返す。
 *               false が返ったら繰り返しをやめる
 */
export function createPressRepeat(onStep: () => boolean): { start(): void; stop(): void } {
  let delay: ReturnType<typeof setTimeout> | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    clearTimeout(delay);
    clearInterval(interval);
  };

  /** 1段階動かす。動けなかったら繰り返しをやめる */
  const step = (): boolean => {
    if (onStep()) return true;
    stop();
    return false;
  };

  return {
    start() {
      // pointerup を取りこぼしたまま押し直されても、繰り返しを二重にしない
      stop();
      if (!step()) return;
      delay = setTimeout(() => {
        if (!step()) return;
        interval = setInterval(step, REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    },
    stop,
  };
}
