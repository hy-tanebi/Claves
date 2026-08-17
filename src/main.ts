import { toPlaybackEvents } from "./domain/derive";
import { FIXTURE_2_4, FIXTURE_4_4, FIXTURE_6_8 } from "./domain/fixtures";
import type { Pattern } from "./domain/types";
import { Scheduler } from "./audio/scheduler";
import { createBellBuffers, WebAudioClock } from "./audio/web-audio-clock";

/** 25ms ごとに予約を補充する（設計上の先読み窓は 0.5 秒） */
const PUMP_INTERVAL_MS = 25;

/** 収録パターンが揃うまでの仮の一覧 */
const PATTERNS: Pattern[] = [FIXTURE_2_4, FIXTURE_4_4, FIXTURE_6_8];

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`element #${id} not found`);
  return el as T;
};

const els = {
  name: $<HTMLHeadingElement>("patternName"),
  meta: $<HTMLParagraphElement>("patternMeta"),
  dots: $<HTMLDivElement>("dots"),
  status: $<HTMLParagraphElement>("status"),
  pattern: $<HTMLSelectElement>("pattern"),
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

let pattern = PATTERNS[0]!;
let bpm = Number(els.bpm.value);
/** noteId → ドット要素 */
let dotOf = new Map<string, HTMLElement>();

function renderPatternInfo(): void {
  const { beats, beatUnit } = pattern.meter;
  els.name.textContent = pattern.name;
  els.meta.textContent = `${beats}/${beatUnit}　${pattern.bars.length}小節　BPM基準 ${pattern.bpmUnit === 144 ? "付点4分" : "4分"}音符`;

  els.dots.replaceChildren();
  dotOf = new Map();
  for (const ev of toPlaybackEvents(pattern)) {
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.dataset.pitch = ev.pitch;
    dot.title = `tick ${ev.tick}`;
    els.dots.append(dot);
    dotOf.set(ev.noteId, dot);
  }
}

function flash(noteId: string): void {
  const dot = dotOf.get(noteId);
  if (!dot) return;
  dot.classList.add("on");
  window.setTimeout(() => dot.classList.remove("on"), 90);
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

async function ensureAudio(): Promise<{ ctx: AudioContext; clock: WebAudioClock }> {
  if (ctx && clock) {
    if (ctx.state === "suspended") await ctx.resume();
    return { ctx, clock };
  }
  const created = new AudioContext();
  // iOS ではユーザー操作の中でしか開始できない
  await created.resume();
  const built = new WebAudioClock(created, createBellBuffers(created));
  built.setVolume(Number(els.volume.value) / 100);
  ctx = created;
  clock = built;
  return { ctx: created, clock: built };
}

async function play(): Promise<void> {
  const audio = await ensureAudio();
  scheduler = new Scheduler(audio.clock);
  // 少しだけ先から始める（開始直後の予約が過去にならないように）
  scheduler.start(pattern, bpm, audio.clock.now() + 0.1);

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

els.pattern.addEventListener("change", () => {
  pattern = PATTERNS[Number(els.pattern.value)]!;
  renderPatternInfo();
  if (scheduler) {
    scheduler.requestPatternChange(pattern, bpm);
    els.status.textContent = "再生中　次の拍から切替";
  }
});

// 初期化
PATTERNS.forEach((p, i) => {
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = `${p.name}（${p.meter.beats}/${p.meter.beatUnit}）`;
  els.pattern.append(opt);
});
els.bpmValue.value = String(bpm);
renderPatternInfo();
