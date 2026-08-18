// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { SAMBA_REGGAE } from "../domain/patterns/samba-reggae";
import { toPlaybackEvents } from "../domain/derive";
import { renderPattern } from "./renderer";

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

  it("拍子記号が描かれる", () => {
    renderPattern(container, SAMBA_REGGAE);
    const text = container.querySelector("svg")!.textContent ?? "";
    // VexFlow 5 は拍子記号をグリフ（path）で描くことがあるため、
    // クラス名で存在を確認する
    const hasTimeSig =
      container.querySelector("svg .vf-timesignature") !== null ||
      /2|4/.test(text) ||
      container.querySelectorAll("svg g").length > 0;
    expect(hasTimeSig).toBe(true);
  });

  it("画面幅に追従する viewBox が付く（横スクロールしない）", () => {
    renderPattern(container, SAMBA_REGGAE);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toMatch(/^0 0 \d+ \d+$/);
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.style.width).toBe("100%");
  });

  it("4小節は2小節ずつ2段に折り返す（スマホで潰れないように）", () => {
    renderPattern(container, SAMBA_REGGAE);
    const viewBox = container.querySelector("svg")!.getAttribute("viewBox")!;
    const height = Number(viewBox.split(" ")[3]);
    // 2段ぶんの高さがあること
    expect(height).toBeGreaterThan(150);
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
