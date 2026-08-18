import {
  Beam,
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

/**
 * 1段あたりの小節数。
 * スマホの幅に4小節を詰めると音符が潰れるので、2小節ずつ折り返す。
 */
const BARS_PER_SYSTEM = 2;

/**
 * 論理座標の幅。実際の表示幅には viewBox で合わせる。
 * **この値が小さいほど、画面上では大きく表示される。**
 * 320px 前後のスマホで音符がはっきり読める大きさに合わせてある。
 */
const SYSTEM_WIDTH = 250;
const SYSTEM_HEIGHT = 92;
const STAVE_TOP = 18;
const SIDE_PADDING = 6;
/** 最初の小節は音部記号と拍子記号のぶん広くする */
const FIRST_BAR_EXTRA = 46;

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
  return new StaveNote({
    keys: [key],
    duration: durationOf(item),
    // 打楽器譜なので符尾の向きは上に揃える（読みやすさ優先）
    stemDirection: 1,
  });
}

/** domain 側で決めた連桁グループを VexFlow の Beam にする */
function buildBeams(bar: Bar, pattern: Pattern, notes: StaveNote[]): Beam[] {
  return computeBeams(bar, pattern.meter)
    .map(([from, to]) => notes.slice(from, to + 1))
    .filter((group) => group.length >= 2)
    .map((group) => new Beam(group));
}

/**
 * パターンを五線譜として描く。
 *
 * 小節を BARS_PER_SYSTEM ごとに折り返して複数段にする。
 * 論理幅で組んでから viewBox で表示幅に合わせるため、
 * 画面幅が変わっても横スクロールは発生しない。
 */
export function renderPattern(container: HTMLDivElement, pattern: Pattern): RenderedNotation {
  container.replaceChildren();

  const systems: Bar[][] = [];
  for (let i = 0; i < pattern.bars.length; i += BARS_PER_SYSTEM) {
    systems.push(pattern.bars.slice(i, i + BARS_PER_SYSTEM));
  }
  const totalHeight = systems.length * SYSTEM_HEIGHT;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(SYSTEM_WIDTH, totalHeight);
  const ctx: RenderContext = renderer.getContext();

  const noteElements = new Map<string, SVGElement>();
  const beamsToDraw: Beam[] = [];

  systems.forEach((bars, si) => {
    const y = STAVE_TOP + si * SYSTEM_HEIGHT;
    // 段ごとに、最初の小節だけ音部記号と拍子記号を出す
    const usable = SYSTEM_WIDTH - SIDE_PADDING * 2 - FIRST_BAR_EXTRA;
    const barWidth = usable / bars.length;

    let x = SIDE_PADDING;

    bars.forEach((bar, bi) => {
      const isFirst = bi === 0;
      const width = isFirst ? barWidth + FIRST_BAR_EXTRA : barWidth;
      const stave = new Stave(x, y, width);

      if (isFirst) {
        stave.addClef("percussion");
        stave.addTimeSignature(`${pattern.meter.beats}/${pattern.meter.beatUnit}`);
      }
      stave.setContext(ctx).draw();

      const notes = bar.items.map(buildNote);
      beamsToDraw.push(...buildBeams(bar, pattern, notes));

      const voice = new Voice({
        numBeats: pattern.meter.beats,
        beatValue: pattern.meter.beatUnit,
      });
      voice.setStrict(true);
      voice.addTickables(notes);

      new Formatter().joinVoices([voice]).format([voice], width - (isFirst ? FIRST_BAR_EXTRA + 14 : 14));
      voice.draw(ctx, stave);

      // 描画後に SVG 要素を回収して noteId と結びつける
      bar.items.forEach((item, i) => {
        if (item.kind !== "note") return;
        const el = notes[i]!.getSVGElement();
        if (el) noteElements.set(item.id, el);
      });

      x += width;
    });
  });

  for (const beam of beamsToDraw) beam.setContext(ctx).draw();

  // 画面幅に追従させる
  const svg = container.querySelector("svg");
  if (svg) {
    svg.setAttribute("viewBox", `0 0 ${SYSTEM_WIDTH} ${totalHeight}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
  }

  return { noteElements };
}
