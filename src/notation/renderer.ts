import {
  Beam,
  Dot,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Voice,
  type RenderContext,
} from "vexflow";
import { computeBeams } from "../domain/beams";
import type { Bar, NotationItem, Pattern, Pitch } from "../domain/types";

/**
 * 打楽器譜の音高位置。
 * アゴゴ／カウベルの高音・低音を五線上の2つの位置に描き分ける。
 */
const STAFF_POSITION: Record<Pitch, string> = {
  high: "c/5",
  low: "f/4",
};

/** 休符は五線の中央に置く */
const REST_POSITION = "b/4";

/** 論理座標。実際の表示幅には viewBox で合わせるので、ここは固定でよい */
const LOGICAL_HEIGHT = 130;
const STAVE_TOP = 24;
const SIDE_PADDING = 8;

export type RenderedNotation = {
  /** noteId → 描画された SVG 要素。ハイライトはこれに直接触る */
  noteElements: Map<string, SVGElement>;
};

/**
 * NotationItem を VexFlow の音価文字列にする。
 *
 * 形式は「音価 + 付点(d) + 種別(r)」。
 * **付点は必ずこの文字列に含める。** Dot モディファイアを後付けするだけでは
 * VexFlow が音価を付点なしとして数え、小節の長さが合わずに
 * IncompleteVoice で落ちる。
 */
function durationOf(item: NotationItem): string {
  const dot = item.dots === 1 ? "d" : "";
  const rest = item.kind === "rest" ? "r" : "";
  return `${item.duration}${dot}${rest}`;
}

function buildNote(item: NotationItem): StaveNote {
  const key = item.kind === "rest" ? REST_POSITION : STAFF_POSITION[item.pitch];
  const note = new StaveNote({
    keys: [key],
    duration: durationOf(item),
    // 打楽器譜なので符尾の向きは上に揃える（読みやすさ優先）
    stemDirection: 1,
  });
  if (item.dots === 1) Dot.buildAndAttach([note], { all: true });
  return note;
}

/**
 * パターンを五線譜として描く。
 *
 * 論理幅で組んでから viewBox で表示幅に合わせるため、
 * 画面幅が変わっても横スクロールは発生しない。
 */
export function renderPattern(
  container: HTMLDivElement,
  pattern: Pattern,
  logicalWidth = 720,
): RenderedNotation {
  container.replaceChildren();

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(logicalWidth, LOGICAL_HEIGHT);
  const ctx: RenderContext = renderer.getContext();

  const noteElements = new Map<string, SVGElement>();

  // 最初の小節だけ拍子記号と音部記号のぶん広くする
  const firstExtra = 56;
  const barCount = pattern.bars.length;
  const usable = logicalWidth - SIDE_PADDING * 2 - firstExtra;
  const barWidth = usable / barCount;

  let x = SIDE_PADDING;
  const beamsToDraw: Beam[] = [];

  pattern.bars.forEach((bar, bi) => {
    const width = bi === 0 ? barWidth + firstExtra : barWidth;
    const stave = new Stave(x, STAVE_TOP, width);

    if (bi === 0) {
      stave.addClef("percussion");
      stave.addTimeSignature(`${pattern.meter.beats}/${pattern.meter.beatUnit}`);
    }
    stave.setContext(ctx).draw();

    const notes = bar.items.map(buildNote);
    const beams = buildBeams(bar, pattern, notes);
    beamsToDraw.push(...beams);

    const voice = new Voice({
      numBeats: pattern.meter.beats,
      beatValue: pattern.meter.beatUnit,
    });
    voice.setStrict(true);
    voice.addTickables(notes);

    new Formatter().joinVoices([voice]).format([voice], width - 24);
    voice.draw(ctx, stave);

    // 描画後に SVG 要素を回収して noteId と結びつける
    bar.items.forEach((item, i) => {
      if (item.kind !== "note") return;
      const el = notes[i]!.getSVGElement();
      if (el) noteElements.set(item.id, el);
    });

    x += width;
  });

  for (const beam of beamsToDraw) beam.setContext(ctx).draw();

  // 画面幅に追従させる
  const svg = container.querySelector("svg");
  if (svg) {
    svg.setAttribute("viewBox", `0 0 ${logicalWidth} ${LOGICAL_HEIGHT}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
  }

  return { noteElements };
}

/** domain 側で決めた連桁グループを VexFlow の Beam にする */
function buildBeams(bar: Bar, pattern: Pattern, notes: StaveNote[]): Beam[] {
  return computeBeams(bar, pattern.meter)
    .map(([from, to]) => notes.slice(from, to + 1))
    .filter((group) => group.length >= 2)
    .map((group) => new Beam(group));
}
