// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { SAMBA_REGGAE } from "../domain/patterns/samba-reggae";
import { toPlaybackEvents } from "../domain/derive";
import { renderPattern } from "./renderer";
import { LAYOUT, measureBars, measureTimeSignatureWidth, planSystems } from "./layout";

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
});

describe("renderPattern", () => {
  it("SVG を1つ描く", () => {
    renderPattern(container, SAMBA_REGGAE);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("すべての音符に SVG 要素が対応づく", () => {
    const { noteElements } = renderPattern(container, SAMBA_REGGAE);
    const events = toPlaybackEvents(SAMBA_REGGAE);

    expect(noteElements.size).toBe(events.length);
    for (const ev of events) {
      expect(noteElements.get(ev.noteId)).toBeInstanceOf(SVGElement);
    }
  });

  it("小節数ぶんの五線が描かれる", () => {
    renderPattern(container, SAMBA_REGGAE);
    // VexFlow は五線を stavenote/stave のクラスで区別する。
    // 五線の横線は path 要素として描かれるので、最低限の本数があることを見る
    const paths = container.querySelectorAll("svg path");
    expect(paths.length).toBeGreaterThan(SAMBA_REGGAE.bars.length * 5);
  });

  it("拍子記号がちょうど1つ描かれる（最初の段の先頭だけ）", () => {
    renderPattern(container, SAMBA_REGGAE);
    expect(container.querySelectorAll("svg .vf-timesignature")).toHaveLength(1);
  });

  it("音部記号は描かない（見本の the Clave にならう）", () => {
    renderPattern(container, SAMBA_REGGAE);
    expect(container.querySelectorAll("svg .vf-clef")).toHaveLength(0);
  });

  it("画面幅に追従する viewBox が付く（横スクロールしない）", () => {
    renderPattern(container, SAMBA_REGGAE);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toMatch(/^0 0 \d+ \d+$/);
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.style.width).toBe("100%");
  });

  it("pt 単位の font-size を残さない（残すと音符だけ巨大化する）", () => {
    renderPattern(container, SAMBA_REGGAE);
    const html = container.querySelector("svg")!.outerHTML;
    // SVG の pt は viewBox の拡縮に追従しないため、
    // 1つでも残っていると五線と音符の比率が壊れる
    expect(html).not.toMatch(/font-size="[\d.]+pt"/);
  });

  it("グリフの大きさが五線の高さと釣り合う", () => {
    renderPattern(container, SAMBA_REGGAE);
    const html = container.querySelector("svg")!.outerHTML;
    const sizes = [...html.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
    // VexFlow の設計上、グリフは五線の高さ（線間10 × 4 = 40）と同じ大きさになる
    expect(Math.max(...sizes)).toBeCloseTo(40, 5);
  });

  it("各段に VexFlow の最小要求以上の幅を与えている", () => {
    // 幅が足りないと VexFlow は音符を詰めて重ねる。これが崩れの直接原因だった
    const timeSigWidth = measureTimeSignatureWidth(SAMBA_REGGAE);
    const bars = measureBars(SAMBA_REGGAE);
    const systems = planSystems(SAMBA_REGGAE, timeSigWidth);

    systems.forEach((system, si) => {
      const required = system.barIndices.reduce((sum, i) => sum + bars[i]!.hard, 0);
      const available =
        LAYOUT.systemWidth - LAYOUT.sidePadding * 2 - (si === 0 ? timeSigWidth : 0);
      expect(available).toBeGreaterThanOrEqual(required);
    });
  });

  it("小節の幅を均等割りせず、必要量の比で配分する", () => {
    // 均等割りだと音符の多い小節が詰まり、少ない小節が間延びする
    const systems = planSystems(SAMBA_REGGAE, measureTimeSignatureWidth(SAMBA_REGGAE));
    const widths = systems.flatMap((s) => s.widths);
    expect(new Set(widths.map((w) => Math.round(w))).size).toBeGreaterThan(1);
  });

  it("Samba Reggae は1段に収まる", () => {
    expect(renderPattern(container, SAMBA_REGGAE).systemCount).toBe(1);
  });

  it("音符と休符の並びが見本どおり（♩. ♪ 𝄽 ♩ / 𝄽 ♩ ♩ 𝄽）", () => {
    const shape = (bar: (typeof SAMBA_REGGAE)["bars"][number]) =>
      bar.items.map((i) => `${i.kind === "rest" ? "r" : "n"}${i.duration}${i.dots ? "." : ""}`);
    expect(shape(SAMBA_REGGAE.bars[0]!)).toEqual(["nq.", "n8", "rq", "nq"]);
    expect(shape(SAMBA_REGGAE.bars[1]!)).toEqual(["rq", "nq", "nq", "rq"]);
  });

  it("2/2 × 2小節で記譜されている", () => {
    expect(SAMBA_REGGAE.meter).toMatchObject({ beats: 2, beatUnit: 2 });
    expect(SAMBA_REGGAE.bars).toHaveLength(2);
  });

  it("打点はソンクラーベ 3-2（8分換算で 0/3/6/10/12）", () => {
    const eighths = toPlaybackEvents(SAMBA_REGGAE).map((e) => e.tick / 48);
    expect(eighths).toEqual([0, 3, 6, 10, 12]);
  });

  it("譜面が論理幅の内側に収まる（はみ出さない）", () => {
    renderPattern(container, SAMBA_REGGAE);
    const svg = container.querySelector("svg")!;
    const logicalWidth = Number(svg.getAttribute("viewBox")!.split(" ")[2]);
    const staveEnds = [...svg.outerHTML.matchAll(/d="M[\d.]+ [\d.]+L([\d.]+) /g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.max(...staveEnds)).toBeLessThanOrEqual(logicalWidth);
  });

  it("再描画しても同じ音符に同じ要素が対応づく（ハイライトが壊れない）", () => {
    const first = renderPattern(container, SAMBA_REGGAE);
    const idsFirst = [...first.noteElements.keys()].sort();

    const second = renderPattern(container, SAMBA_REGGAE);
    const idsSecond = [...second.noteElements.keys()].sort();

    expect(idsSecond).toEqual(idsFirst);
    expect(container.querySelectorAll("svg")).toHaveLength(1); // 古い SVG が残らない
  });

  it("音符に色を付けても座標が動かない", () => {
    const { noteElements } = renderPattern(container, SAMBA_REGGAE);
    const el = noteElements.get("sr1")!;
    const before = el.getAttribute("transform");

    el.classList.add("on");

    expect(el.getAttribute("transform")).toBe(before);
  });
});
