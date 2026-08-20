import { beatUnitLabel, normalizeBpm } from "./domain/bpm";
import { PATTERNS } from "./domain/registry";
import { bpmFromTaps, pushTap } from "./domain/tap-tempo";
import type { Pattern } from "./domain/types";
import { Scheduler } from "./audio/scheduler";
import { createBellBuffers, WebAudioClock } from "./audio/web-audio-clock";
import { renderPattern } from "./notation/renderer";
import { whenMusicFontsReady } from "./notation/fonts";

/** 25ms ごとに予約を補充する（設計上の先読み窓は 0.5 秒） */
const PUMP_INTERVAL_MS = 25;
/** ハイライトを消すまでの時間 */
const FLASH_MS = 110;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`element #${id} not found`);
  return el as T;
};

const els = {
  name: $<HTMLHeadingElement>("patternName"),
  meta: $<HTMLParagraphElement>("patternMeta"),
  score: $<HTMLDivElement>("score"),
  status: $<HTMLParagraphElement>("status"),
  bpm: $<HTMLInputElement>("bpm"),
  bpmValue: $<HTMLOutputElement>("bpmValue"),
  tap: $<HTMLButtonElement>("tap"),
  tapHint: $<HTMLSpanElement>("tapHint"),
  volume: $<HTMLInputElement>("volume"),
  play: $<HTMLButtonElement>("play"),
};

let ctx: AudioContext | null = null;
let clock: WebAudioClock | null = null;
let scheduler: Scheduler | null = null;
let pumpTimer: number | null = null;
let rafId: number | null = null;

const pattern: Pattern = PATTERNS[0]!;
let bpm = normalizeBpm(els.bpm.value) ?? 120;
let noteElements = new Map<string, SVGElement>();
/** タップテンポの打刻。performance.now() の値を積む */
let taps: number[] = [];

function drawScore(): void {
  const { beats, beatUnit } = pattern.meter;
  els.name.textContent = pattern.name;
  els.meta.textContent = `${beats}/${beatUnit}　${pattern.bars.length}小節`;
  // 何を叩けばいいのかを必ず出す。同じ 120 BPM でも
  // 2分音符と4分音符では速さが倍違い、数字だけでは読み取れない
  const unit = beatUnitLabel(pattern.bpmUnit);
  els.tapHint.textContent = unit ? `タップ：${unit}` : "タップしてテンポを取る";
  noteElements = renderPattern(els.score, pattern).noteElements;
}

function flash(noteId: string): void {
  const el = noteElements.get(noteId);
  if (!el) return;
  el.classList.add("on");
  window.setTimeout(() => el.classList.remove("on"), FLASH_MS);
}

/** 画面のハイライトは rAF で更新する（音の予約時刻を過ぎたものを取り出す） */
function startHighlightLoop(): void {
  const tick = () => {
    if (!scheduler || !clock) return;
    for (const h of scheduler.drainHighlightsUpTo(clock.now())) flash(h.noteId);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

async function ensureAudio(): Promise<WebAudioClock> {
  if (ctx && clock) {
    if (ctx.state === "suspended") await ctx.resume();
    return clock;
  }
  const created = new AudioContext();
  // iOS ではユーザー操作の中でしか開始できない
  await created.resume();
  const built = new WebAudioClock(created, createBellBuffers(created));
  built.setVolume(Number(els.volume.value) / 100);
  ctx = created;
  clock = built;
  return built;
}

async function play(): Promise<void> {
  const audioClock = await ensureAudio();
  taps = [];
  scheduler = new Scheduler(audioClock);
  // 少しだけ先から始める（開始直後の予約が過去にならないように）
  scheduler.start(pattern, bpm, audioClock.now() + 0.1);

  pumpTimer = window.setInterval(() => scheduler?.pump(), PUMP_INTERVAL_MS);
  startHighlightLoop();

  els.play.textContent = "停止";
  els.play.dataset.playing = "true";
  els.status.textContent = "再生中";
}

function stop(): void {
  taps = [];
  scheduler?.stop();
  scheduler = null;
  if (pumpTimer !== null) window.clearInterval(pumpTimer);
  if (rafId !== null) cancelAnimationFrame(rafId);
  pumpTimer = null;
  rafId = null;
  for (const el of noteElements.values()) el.classList.remove("on");

  els.play.textContent = "再生";
  els.play.dataset.playing = "false";
  els.status.textContent = "停止中";
}

els.play.addEventListener("click", () => {
  if (scheduler) {
    stop();
  } else {
    void play().catch((e: unknown) => {
      els.status.textContent = `音を再生できません: ${String(e)}`;
    });
  }
});

/**
 * テンポ更新の唯一の入口。スライダーもタップもここを通る。
 *
 * 停止中は値と表示を更新するだけで再生はしない。次に play() したとき
 * この値が Scheduler へ渡る。
 */
function setBpm(next: number): void {
  bpm = next;
  els.bpm.value = String(next);
  els.bpmValue.value = String(next);
  if (scheduler) {
    // 次の拍の頭から効く（予約の取り消しが発生しない）
    scheduler.requestTempoChange(next);
    els.status.textContent = `再生中　次の拍から ${next} BPM`;
  } else {
    els.status.textContent = "停止中";
  }
}

els.bpm.addEventListener("input", () => {
  const next = normalizeBpm(els.bpm.value);
  if (next !== null) setBpm(next);
});

function handleTap(): void {
  taps = pushTap(taps, performance.now());
  if (taps.length < 2) {
    els.status.textContent = "タップを続けてください";
    return;
  }
  const next = bpmFromTaps(taps);
  if (next === null) {
    // 範囲外や乱れたタップ。clamp せず、いまの値を保つ
    els.status.textContent = "テンポを取れません（40〜240 の範囲で一定に）";
    return;
  }
  setBpm(next);
}

const setPressed = (on: boolean) => {
  els.tap.dataset.pressed = String(on);
};

// タップは click ではなく pointerdown で取る。click は押してから離すまで待つ
els.tap.addEventListener("pointerdown", (e) => {
  // マルチタッチの2本目以降と、マウスの左以外は無視する
  if (!e.isPrimary || e.button !== 0) return;
  setPressed(true);
  handleTap();
});
for (const type of ["pointerup", "pointercancel", "pointerleave"] as const) {
  els.tap.addEventListener(type, () => setPressed(false));
}

// キーボードからも叩けるようにする。button は Enter / Space で click を出すが、
// click は押しっぱなしの間隔を測れないので keydown で受ける
els.tap.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault(); // Space によるスクロールを止める
  setPressed(true);
  handleTap();
});
els.tap.addEventListener("keyup", () => setPressed(false));
els.tap.addEventListener("blur", () => setPressed(false));

els.volume.addEventListener("input", () => {
  clock?.setVolume(Number(els.volume.value) / 100);
});

// 初期化
els.bpm.value = String(bpm);
els.bpmValue.value = String(bpm);

// 音楽フォントの読み込みを待ってから描く。
// 待たずに描くと VexFlow が代替フォントの幅で位置を計算し、
// 符尾が符頭から離れ、小節幅も膨れて段が余計に増える。
void whenMusicFontsReady().then(drawScore);
