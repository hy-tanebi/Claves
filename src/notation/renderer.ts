import { Barline, Beam, Formatter, Renderer, Stave, type RenderContext } from "vexflow";
import { computeBeams } from "../domain/beams";
import type { Bar, Pattern } from "../domain/types";
import {
  buildVoice,
  LAYOUT,
  measureTimeSignatureWidth,
  planSystems,
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
      if (si === 0 && isFirstOfSystem) {
        stave.addTimeSignature(`${pattern.meter.beats}/${pattern.meter.beatUnit}`);
      }
      // 見本にならい、パターンの始まりと終わりを複縦線で囲む
      stave.setBegBarType(isFirstOfPattern ? Barline.type.DOUBLE : Barline.type.SINGLE);
      stave.setEndBarType(isLastOfPattern ? Barline.type.DOUBLE : Barline.type.SINGLE);
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
    svg.setAttribute("viewBox", `0 0 ${LAYOUT.systemWidth} ${logicalHeight}`);
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
