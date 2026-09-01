import { normalizeBpm } from "./domain/bpm";
import { toPlaybackEvents } from "./domain/derive";
import { PATTERNS, pickPattern } from "./domain/registry";
import { bpmFromTaps, pushTap } from "./domain/tap-tempo";
import type { Pattern } from "./domain/types";
import { Scheduler } from "./audio/scheduler";
import { createClickBuffers, WebAudioClock } from "./audio/web-audio-clock";
import { nativeAudio } from "./audio/native-plugin";
import { noteIdAtTick } from "./domain/playhead";
import { renderPattern } from "./notation/renderer";
import { whenMusicFontsReady } from "./notation/fonts";
import { loadPatternId, loadTimbre, savePatternId, saveTimbre } from "./preferences";
import { pickTimbre, TIMBRE_LABELS, type Timbre } from "./audio/bell";

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
  name: $<HTMLSpanElement>("patternName"),
  picker: $<HTMLButtonElement>("patternPicker"),
  dialog: $<HTMLDialogElement>("patternDialog"),
  list: $<HTMLUListElement>("patternList"),
  close: $<HTMLButtonElement>("patternClose"),
  score: $<HTMLDivElement>("score"),
  status: $<HTMLParagraphElement>("status"),
  bpm: $<HTMLInputElement>("bpm"),
  bpmValue: $<HTMLOutputElement>("bpmValue"),
  tap: $<HTMLButtonElement>("tap"),
  volume: $<HTMLInputElement>("volume"),
  timbre: $<HTMLButtonElement>("timbre"),
  timbreLabel: $<HTMLSpanElement>("timbreLabel"),
  play: $<HTMLButtonElement>("play"),
};

let ctx: AudioContext | null = null;
let clock: WebAudioClock | null = null;
let scheduler: Scheduler | null = null;
let pumpTimer: number | null = null;
let rafId: number | null = null;

/** 画面に出ているリズム。切替の唯一の持ち主。前回選んだものから始める */
let pattern: Pattern = pickPattern(loadPatternId());
/**
 * 再生中に切替を予約したリズム。**新しいリズムの音が実際に鳴った瞬間**に
 * 譜面を差し替えるため、それまで持っておく。
 */
let switchingTo: Pattern | null = null;
/** 切替先の打点 id。これが鳴ったら切替が発音まで到達したと判る */
let switchingIds = new Set<string>();
let bpm = normalizeBpm(els.bpm.value) ?? 120;
let noteElements = new Map<string, SVGElement>();
/** タップテンポの打刻。performance.now() の値を積む */
let taps: number[] = [];
/** いま鳴らす音色。前回選んだものから始める */
let timbre: Timbre = pickTimbre(loadTimbre());

function drawScore(): void {
  els.name.textContent = pattern.name;
  noteElements = renderPattern(els.score, pattern).noteElements;
}

/**
 * 状態表示。**普段は空にしておく。**
 * 音を出せないときだけ理由を出すために残している。
 * ここを完全に無くすと、初期化に失敗しても画面が無反応になるだけで
 * 原因が分からなくなる。
 */
function showError(message: string): void {
  els.status.textContent = message;
}

function clearError(): void {
  els.status.textContent = "";
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
    for (const h of scheduler.drainHighlightsUpTo(clock.now())) {
      // 切替先の打点が鳴った瞬間に譜面を差し替える。
      //
      // **Scheduler の pending が消えたかどうかで判定してはいけない。**
      // pending は先読み窓の中で「予約が確定した」時点で消えるので、
      // 実際に音が鳴るより最大1拍早い。それで判定すると、
      // 譜面だけ先に変わって音と絵がずれる。
      if (switchingTo && switchingIds.has(h.noteId)) {
        pattern = switchingTo;
        switchingTo = null;
        switchingIds = new Set();
        drawScore();
        markCurrent();
      }
      flash(h.noteId);
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

/**
 * ネイティブ再生中のハイライト。
 *
 * **再生位置はネイティブに聞く。** 時計を持っているのはネイティブなので、
 * JS 側で別に数えると必ずずれる。
 */
function startNativeHighlightLoop(): void {
  let lastNoteId: string | null = null;
  let lastTick = -1;

  const step = async (): Promise<void> => {
    if (!nativeAudio || els.play.dataset.playing !== "true") return;

    const snapshot = await nativeAudio.snapshot();
    if (snapshot.isPlaying) {
      // 切替が起きると、新しい計画の基準点に合わせて tick が 0 付近へ戻る。
      // **これが「新しいリズムの音が実際に鳴り始めた」合図。**
      // 予約が確定した時点で譜面を差し替えると、音より先に絵が変わる
      if (switchingTo && snapshot.tick < lastTick) {
        pattern = switchingTo;
        switchingTo = null;
        switchingIds = new Set();
        drawScore();
        markCurrent();
        lastNoteId = null;
      }
      lastTick = snapshot.tick;

      const noteId = noteIdAtTick(pattern, snapshot.tick);
      if (noteId !== lastNoteId) {
        flash(noteId);
        lastNoteId = noteId;
      }
    }
    rafId = requestAnimationFrame(() => void step());
  };

  rafId = requestAnimationFrame(() => void step());
}

async function ensureAudio(): Promise<WebAudioClock> {
  if (ctx && clock) {
    if (ctx.state === "suspended") await ctx.resume();
    return clock;
  }
  const created = new AudioContext();
  // iOS ではユーザー操作の中でしか開始できない
  await created.resume();
  const built = new WebAudioClock(created, createClickBuffers(created));
  built.setVolume(Number(els.volume.value) / 100);
  built.setTimbre(timbre);
  ctx = created;
  clock = built;
  return built;
}

async function play(): Promise<void> {
  taps = [];

  if (nativeAudio) {
    // iOS ではバックグラウンドで WKWebView ごと止まるため、
    // 再生クロックはネイティブが持つ。JS は計画を渡すだけ
    await nativeAudio.start(pattern, bpm);
    await nativeAudio.setVolume(Number(els.volume.value) / 100);
    startNativeHighlightLoop();
  } else {
    const audioClock = await ensureAudio();
    scheduler = new Scheduler(audioClock);
    // 少しだけ先から始める（開始直後の予約が過去にならないように）
    scheduler.start(pattern, bpm, audioClock.now() + 0.1);

    pumpTimer = window.setInterval(() => scheduler?.pump(), PUMP_INTERVAL_MS);
    startHighlightLoop();
  }

  els.play.textContent = "STOP";
  els.play.dataset.playing = "true";
  clearError();
}

function stop(): void {
  taps = [];
  // 切替の予約中に止めたら、選んだリズムはそのまま採用する
  if (switchingTo) {
    pattern = switchingTo;
    switchingTo = null;
    switchingIds = new Set();
    drawScore();
    markCurrent();
  }
  void nativeAudio?.stop();
  scheduler?.stop();
  scheduler = null;
  if (pumpTimer !== null) window.clearInterval(pumpTimer);
  if (rafId !== null) cancelAnimationFrame(rafId);
  pumpTimer = null;
  rafId = null;
  for (const el of noteElements.values()) el.classList.remove("on");

  els.play.textContent = "PLAY";
  els.play.dataset.playing = "false";
}

els.play.addEventListener("click", () => {
  // **`scheduler` の有無で判定してはいけない。**
  // ネイティブ再生では scheduler を作らないので、常に停止中と見なしてしまう
  if (els.play.dataset.playing === "true") {
    stop();
  } else {
    void play().catch((e: unknown) => {
      showError(`Audio unavailable: ${String(e)}`);
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
  // 次の拍の頭から効く（予約の取り消しが発生しない）
  scheduler?.requestTempoChange(next);
  // ネイティブ再生中も同じ。基準点は切替点にネイティブが合わせ直す
  if (nativeAudio && els.play.dataset.playing === "true") {
    void nativeAudio.change(pattern, next);
  }
}

/**
 * 音色を変える唯一の入口。
 *
 * **鳴っている最中でも切り替えられる。** 波形は全音色ぶん作り置きしてあるので、
 * ブラウザ側もネイティブ側も選び直すだけで済む。
 * すでに予約済みの打点は元の音色のまま鳴り終わる。
 */
function setTimbre(next: Timbre): void {
  timbre = next;
  els.timbreLabel.textContent = TIMBRE_LABELS[next];
  clock?.setTimbre(next);
  void nativeAudio?.setTimbre(next);
  saveTimbre(next);
}

els.timbre.addEventListener("click", () => {
  setTimbre(timbre === "agogo" ? "claves" : "agogo");
});

els.bpm.addEventListener("input", () => {
  const next = normalizeBpm(els.bpm.value);
  if (next !== null) setBpm(next);
});

function handleTap(): void {
  taps = pushTap(taps, performance.now());
  // 2打目から値が出る。範囲外や乱れたタップは clamp せず、いまの値を保つ
  const next = bpmFromTaps(taps);
  if (next !== null) setBpm(next);
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

/* ---- リズムの切替 ---- */

function selectPattern(next: Pattern): void {
  if (next.id === pattern.id) return;
  // 拍子が変わるとタップ1打の意味が変わる。履歴は持ち越さない
  taps = [];
  // 実際に鳴り始めるのは次の拍境界だが、選んだ時点の意思を覚える。
  // アプリは OS に落とされて再起動されるので、毎回1曲目に戻ると練習の邪魔になる
  savePatternId(next.id);

  if (nativeAudio && els.play.dataset.playing === "true") {
    // 次の拍境界から新パターンの先頭で鳴り始める。
    // 譜面は tick が戻った瞬間（＝実際に鳴り始めた合図）に差し替える
    void nativeAudio.change(next, bpm);
    switchingTo = next;
    switchingIds = new Set(toPlaybackEvents(next).map((e) => e.noteId));
    markCurrent();
    return;
  }

  if (scheduler) {
    // 次の拍境界から、新パターンの先頭で鳴り始める。
    // 譜面は切り替わった瞬間に差し替える（rAF ループが検知する）
    scheduler.requestPatternChange(next, bpm);
    switchingTo = next;
    switchingIds = new Set(toPlaybackEvents(next).map((e) => e.noteId));
    markCurrent();
    return;
  }

  pattern = next;
  drawScore();
  markCurrent();
}

/**
 * 一覧の行。**パターンごとに1度だけ組む。**
 * 行ごとに譜面を描くので、開くたびに作り直すと無駄が大きい。
 * 以後は選択状態だけ差し替える。
 */
const listRows = new Map<string, HTMLButtonElement>();

function buildList(): void {
  listRows.clear();
  els.list.replaceChildren(
    ...PATTERNS.map((p) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sheetItem";

      const name = document.createElement("span");
      name.className = "sheetName";
      name.textContent = p.name;

      // 行に譜面を出す。名前と拍子だけでは、鳴らさないと区別がつかない
      const score = document.createElement("div");
      score.className = "rowScore";
      renderPattern(score, p);

      btn.append(name, score);
      btn.addEventListener("click", () => {
        selectPattern(p);
        els.dialog.close();
      });
      li.append(btn);
      listRows.set(p.id, btn);
      return li;
    }),
  );
  markCurrent();
}

/** 選択中の行に印を付ける。再生中の切替予約中は「切替先」を選択中として扱う */
function markCurrent(): void {
  const shown = switchingTo ?? pattern;
  for (const [id, btn] of listRows) {
    if (id === shown.id) btn.setAttribute("aria-current", "true");
    else btn.removeAttribute("aria-current");
  }
}

els.picker.addEventListener("click", () => {
  els.dialog.showModal();
  // **`showModal()` は最初のフォーカス可能な要素にフォーカスする。**
  // 一覧では先頭の行がそれにあたり、常に先頭のリズムが選ばれて見えていた。
  // いま選ばれている行へ移し、フォーカスと赤枠の位置を一致させる
  listRows.get((switchingTo ?? pattern).id)?.focus();
});
els.close.addEventListener("click", () => els.dialog.close());
// 背景（backdrop）を叩いたら閉じる。dialog 自身が click の対象になる
els.dialog.addEventListener("click", (e) => {
  if (e.target === els.dialog) els.dialog.close();
});

els.volume.addEventListener("input", () => {
  const value = Number(els.volume.value) / 100;
  clock?.setVolume(value);
  void nativeAudio?.setVolume(value);
});

// ネイティブ都合の再生・停止に画面を追従させる。
//
// **割り込み（着信・Siri）やイヤホン抜去でネイティブが止めても、
// JS が知らないとボタンが「再生中」のまま残る。**
// ロック画面から操作されたときも同じ。
if (nativeAudio) {
  void nativeAudio.onPlaybackStopped(() => {
    if (els.play.dataset.playing === "true") stop();
  });
  void nativeAudio.onPlaybackStarted(() => {
    if (els.play.dataset.playing !== "true") {
      els.play.textContent = "STOP";
      els.play.dataset.playing = "true";
      startNativeHighlightLoop();
      clearError();
    }
  });
}

// 初期化
els.bpm.value = String(bpm);
els.bpmValue.value = String(bpm);
els.timbreLabel.textContent = TIMBRE_LABELS[timbre];
// **停止中でもネイティブは覚えてくれる。** 次に鳴らすときからこの音色で始まる
void nativeAudio?.setTimbre(timbre);

// 音楽フォントの読み込みを待ってから描く。
// 待たずに描くと VexFlow が代替フォントの幅で位置を計算し、
// 符尾が符頭から離れ、小節幅も膨れて段が余計に増える。
void whenMusicFontsReady().then(() => {
  drawScore();
  buildList();
});
