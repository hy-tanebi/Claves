import { PATTERNS } from "./domain/registry";
import type { Pattern } from "./domain/types";
import { Scheduler } from "./audio/scheduler";
import { createBellBuffers, WebAudioClock } from "./audio/web-audio-clock";
import { renderPattern } from "./notation/renderer";

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
  volume: $<HTMLInputElement>("volume"),
  play: $<HTMLButtonElement>("play"),
};

let ctx: AudioContext | null = null;
let clock: WebAudioClock | null = null;
let scheduler: Scheduler | null = null;
let pumpTimer: number | null = null;
let rafId: number | null = null;

const pattern: Pattern = PATTERNS[0]!;
let bpm = Number(els.bpm.value);
let noteElements = new Map<string, SVGElement>();

function drawScore(): void {
  const { beats, beatUnit } = pattern.meter;
  els.name.textContent = pattern.name;
  els.meta.textContent = `${beats}/${beatUnit}　${pattern.bars.length}小節`;
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

els.bpm.addEventListener("input", () => {
  bpm = Number(els.bpm.value);
  els.bpmValue.value = String(bpm);
  if (scheduler) {
    // 次の拍の頭から効く（予約の取り消しが発生しない）
    scheduler.requestTempoChange(bpm);
    els.status.textContent = `再生中　次の拍から ${bpm} BPM`;
  }
});

els.volume.addEventListener("input", () => {
  clock?.setVolume(Number(els.volume.value) / 100);
});

// 初期化
els.bpmValue.value = String(bpm);
drawScore();
