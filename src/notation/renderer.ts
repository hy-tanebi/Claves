import { Barline, Beam, Formatter, Renderer, Stave, type RenderContext } from "vexflow";
import { computeBeams } from "../domain/beams";
import type { Bar, Pattern } from "../domain/types";
import {
  buildVoice,
  LAYOUT,
  measureTimeSignatureWidth,
  planSystems,
  LINE_VISIBILITY,
  PT_TO_UNIT,
  type SystemPlan,
} from "./layout";

export type RenderedNotation = {
  /** noteId → 描画された SVG 要素。ハイライトはこれに直接触る */
  noteElements: Map<string, SVGElement>;
  /** 段数（テストと調整の確認用） */
  systemCount: number;
  /** 論理サイズ */
  logicalWidth: number;
  logicalHeight: number;
};

/**
 * VexFlow が付ける pt 単位の font-size を、ユーザー単位の数値に置き換える。
 *
 * SVG では pt などの絶対単位は viewBox の拡大縮小に追従しない。
 * そのまま viewBox を縮めると、五線だけが小さくなり音符と拍子記号が
 * 取り残されて巨大に見える。単位なしの値にすればユーザー座標として扱われ、
 * 五線と一緒に拡縮される。
 */
function normalizeFontUnits(svg: SVGElement): void {
  for (const el of [svg, ...Array.from(svg.querySelectorAll("*"))]) {
    const size = el.getAttribute("font-size");
    if (!size) continue;
    const pt = /^([\d.]+)pt$/.exec(size);
    if (pt) el.setAttribute("font-size", String(Number(pt[1]) * PT_TO_UNIT));
  }
}

/**
 * 実際に描かれた内容に合わせて viewBox の縦範囲を決める。
 *
 * 高さを定数で決め打つと、拍子記号の数字や符尾が上下にはみ出して
 * 見切れる。どこまで描かれたかは拍子や音価によって変わるため、
 * 描画後に実測して合わせる。
 *
 * **横は LAYOUT.systemWidth のまま固定する。** 横も内容に合わせると
 * パターンごとに表示倍率が変わり、リズムを切り替えたときに
 * 譜面の大きさが揃わなくなる。
 */
function fitViewBox(svg: SVGElement, fallbackHeight: number): string {
  const PAD = 8;
  let top = Infinity;
  let bottom = -Infinity;
  const cover = (a: number, b: number) => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    top = Math.min(top, a);
    bottom = Math.max(bottom, b);
  };

  // 譜表の線・符尾・連桁は path。d から座標を直接読む（正確）
  for (const path of Array.from(svg.querySelectorAll("path"))) {
    const d = path.getAttribute("d") ?? "";
    for (const m of d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)) {
      const y = Number(m[2]);
      cover(y, y);
    }
  }

  // 小節線は rect
  for (const rect of Array.from(svg.querySelectorAll("rect"))) {
    const y = Number(rect.getAttribute("y"));
    const h = Number(rect.getAttribute("height"));
    cover(y, y + h);
  }

  // グリフは text。**枠ではなくインクを測る。**
  // SVG テキストの枠は音楽フォントの巨大な行送りを含み、実際の
  // 5倍近くになるため、そのまま使うと余白だらけの譜面になる。
  const ctx = inkMeasureContext();
  if (ctx) {
    for (const text of Array.from(svg.querySelectorAll("text"))) {
      const size = Number(text.getAttribute("font-size"));
      const y = Number(text.getAttribute("y"));
      if (!Number.isFinite(size) || !Number.isFinite(y)) continue;
      ctx.font = `${size}px Bravura`;
      const m = ctx.measureText(text.textContent ?? "");
      cover(y - m.actualBoundingBoxAscent, y + m.actualBoundingBoxDescent);
    }
  }

  if (!Number.isFinite(top) || bottom <= top) {
    return `0 0 ${LAYOUT.systemWidth} ${fallbackHeight}`;
  }
  return `0 ${top - PAD} ${LAYOUT.systemWidth} ${bottom - top + PAD * 2}`;
}

/** テキストのインクを測るための canvas。jsdom では使えないので null を返す */
function inkMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  const ctx = document.createElement("canvas").getContext("2d");
  // jsdom の canvas は measureText を持たない
  if (!ctx || typeof ctx.measureText !== "function") return null;
  const probe = ctx.measureText("x");
  return typeof probe.actualBoundingBoxAscent === "number" ? ctx : null;
}

/** domain 側で決めた連桁グループを VexFlow の Beam にする */
function buildBeams(
  bar: Bar,
  pattern: Pattern,
  notes: ReturnType<typeof buildVoice>["notes"],
): Beam[] {
  return computeBeams(bar, pattern.meter)
    .map(([from, to]) => notes.slice(from, to + 1))
    .filter((group) => group.length >= 2)
    .map((group) => new Beam(group));
}

/**
 * パターンを五線譜として描く。
 *
 * 見本の the Clave にならい、音部記号は出さず、複縦線で囲む。
 * 幅は全パターン共通の固定値（LAYOUT.systemWidth）で、
 * 収まらないパターンは段を増やす。これによりリズムを切り替えても
 * 譜面の大きさが揃う。
 */
export function renderPattern(container: HTMLDivElement, pattern: Pattern): RenderedNotation {
  container.replaceChildren();

  const timeSigWidth = measureTimeSignatureWidth(pattern);
  const systems = planSystems(pattern, timeSigWidth);
  const logicalHeight = systems.length * LAYOUT.systemHeight;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(LAYOUT.systemWidth, logicalHeight);
  const ctx: RenderContext = renderer.getContext();

  const noteElements = new Map<string, SVGElement>();
  const beamsToDraw: Beam[] = [];
  const lastBarIndex = pattern.bars.length - 1;

  systems.forEach((system: SystemPlan, si) => {
    const y = LAYOUT.staveTop + si * LAYOUT.systemHeight;
    let x = LAYOUT.sidePadding;

    system.barIndices.forEach((barIndex, i) => {
      const bar = pattern.bars[barIndex]!;
      const isFirstOfSystem = i === 0;
      const isFirstOfPattern = barIndex === 0;
      const isLastOfPattern = barIndex === lastBarIndex;

      // 拍子記号は最初の段の先頭にだけ出す（通常の記譜の作法）
      const extra = si === 0 && isFirstOfSystem ? timeSigWidth : 0;
      const width = system.widths[i]! + extra;

      const stave = new Stave(x, y, width);
      stave.setConfigForLines(LINE_VISIBILITY);
      if (si === 0 && isFirstOfSystem) {
        stave.addTimeSignature(`${pattern.meter.beats}/${pattern.meter.beatUnit}`);
      }
      // 繰り返して鳴らすパターンなので、リピート記号で囲む
      stave.setBegBarType(isFirstOfPattern ? Barline.type.REPEAT_BEGIN : Barline.type.SINGLE);
      stave.setEndBarType(isLastOfPattern ? Barline.type.REPEAT_END : Barline.type.SINGLE);
      stave.setContext(ctx).draw();

      const { voice, notes } = buildVoice(bar, pattern);
      beamsToDraw.push(...buildBeams(bar, pattern, notes));

      // 音符を並べる幅は stave が持つ音符領域から取る。
      // 自前で引き算すると、拍子記号や小節線の幅とずれる。
      // 末尾に余白を残すのは、休符などグリフの送り幅が見た目より広く、
      // 詰めると小節線に貼り付いて見えるため。
      const noteArea = stave.getNoteEndX() - stave.getNoteStartX();
      new Formatter()
        .joinVoices([voice])
        .format([voice], Math.max(20, noteArea - LAYOUT.barTailPadding));
      voice.draw(ctx, stave);

      bar.items.forEach((item, k) => {
        if (item.kind !== "note") return;
        const el = notes[k]!.getSVGElement();
        if (el) noteElements.set(item.id, el);
      });

      x += width;
    });
  });

  for (const beam of beamsToDraw) beam.setContext(ctx).draw();

  const svg = container.querySelector("svg");
  if (svg) {
    normalizeFontUnits(svg);
    svg.setAttribute("viewBox", fitViewBox(svg, logicalHeight));
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
  }

  return {
    noteElements,
    systemCount: systems.length,
    logicalWidth: LAYOUT.systemWidth,
    logicalHeight,
  };
}
