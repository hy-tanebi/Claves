// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { SON_CLAVE } from "../domain/patterns/son-clave";
import { AFRO_GROOVE_6_8 } from "../domain/patterns/afro-groove-6-8";
import { AFRO_GROOVE_6_8_2 } from "../domain/patterns/afro-groove-6-8-2";
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
    renderPattern(container, SON_CLAVE);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("すべての音符に SVG 要素が対応づく", () => {
    const { noteElements } = renderPattern(container, SON_CLAVE);
    const events = toPlaybackEvents(SON_CLAVE);

    expect(noteElements.size).toBe(events.length);
    for (const ev of events) {
      expect(noteElements.get(ev.noteId)).toBeInstanceOf(SVGElement);
    }
  });

  it("小節数ぶんの五線が描かれる", () => {
    renderPattern(container, SON_CLAVE);
    // VexFlow は五線を stavenote/stave のクラスで区別する。
    // 五線の横線は path 要素として描かれるので、最低限の本数があることを見る
    const paths = container.querySelectorAll("svg path");
    expect(paths.length).toBeGreaterThan(SON_CLAVE.bars.length * 5);
  });

  it("拍子記号がちょうど1つ描かれる（最初の段の先頭だけ）", () => {
    renderPattern(container, SON_CLAVE);
    expect(container.querySelectorAll("svg .vf-timesignature")).toHaveLength(1);
  });

  it("音部記号は描かない（見本の the Clave にならう）", () => {
    renderPattern(container, SON_CLAVE);
    expect(container.querySelectorAll("svg .vf-clef")).toHaveLength(0);
  });

  it("画面幅に追従する viewBox が付く（横スクロールしない）", () => {
    renderPattern(container, SON_CLAVE);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toMatch(/^0 -?[\d.]+ \d+ [\d.]+$/);
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.style.width).toBe("100%");
  });

  it("pt 単位の font-size を残さない（残すと音符だけ巨大化する）", () => {
    renderPattern(container, SON_CLAVE);
    const html = container.querySelector("svg")!.outerHTML;
    // SVG の pt は viewBox の拡縮に追従しないため、
    // 1つでも残っていると五線と音符の比率が壊れる
    expect(html).not.toMatch(/font-size="[\d.]+pt"/);
  });

  it("グリフの大きさが五線の高さと釣り合う", () => {
    renderPattern(container, SON_CLAVE);
    const html = container.querySelector("svg")!.outerHTML;
    const sizes = [...html.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
    // VexFlow の設計上、グリフは五線の高さ（線間10 × 4 = 40）と同じ大きさになる
    expect(Math.max(...sizes)).toBeCloseTo(40, 5);
  });

  it("各段に VexFlow の最小要求以上の幅を与えている", () => {
    // 幅が足りないと VexFlow は音符を詰めて重ねる。これが崩れの直接原因だった
    const timeSigWidth = measureTimeSignatureWidth(SON_CLAVE);
    const bars = measureBars(SON_CLAVE);
    const systems = planSystems(SON_CLAVE, timeSigWidth);

    systems.forEach((system, si) => {
      const required = system.barIndices.reduce((sum, i) => sum + bars[i]!, 0);
      const available =
        LAYOUT.systemWidth - LAYOUT.sidePadding * 2 - (si === 0 ? timeSigWidth : 0);
      expect(available).toBeGreaterThanOrEqual(required);
    });
  });

  it("同じ長さの小節には同じ幅を配る", () => {
    // バリデータが全小節を同じ tick 長に強制しているので、幅も揃うのが正しい。
    // 中身の要求量の比で配ると、同じ長さなのに幅が 1.5 倍近く変わって傾いて見える
    for (const p of [SON_CLAVE, AFRO_GROOVE_6_8]) {
      const widths = planSystems(p, measureTimeSignatureWidth(p)).flatMap((s) => s.widths);
      expect(`${p.id}: ${new Set(widths.map((w) => Math.round(w))).size}`).toBe(`${p.id}: 1`);
    }
  });

  it("Son Clave は1段に収まる", () => {
    expect(renderPattern(container, SON_CLAVE).systemCount).toBe(1);
  });

  it("音符と休符の並びが見本どおり（♩. ♪ 𝄽 ♩ / 𝄽 ♩ ♩ 𝄽）", () => {
    const shape = (bar: (typeof SON_CLAVE)["bars"][number]) =>
      bar.items.map((i) => `${i.kind === "rest" ? "r" : "n"}${i.duration}${i.dots ? "." : ""}`);
    expect(shape(SON_CLAVE.bars[0]!)).toEqual(["nq.", "n8", "rq", "nq"]);
    expect(shape(SON_CLAVE.bars[1]!)).toEqual(["rq", "nq", "nq", "rq"]);
  });

  it("2/2 × 2小節で記譜されている", () => {
    expect(SON_CLAVE.meter).toMatchObject({ beats: 2, beatUnit: 2 });
    expect(SON_CLAVE.bars).toHaveLength(2);
  });

  it("打点はソンクラーベ 3-2（8分換算で 0/3/6/10/12）", () => {
    const eighths = toPlaybackEvents(SON_CLAVE).map((e) => e.tick / 48);
    expect(eighths).toEqual([0, 3, 6, 10, 12]);
  });

  it("譜面が論理幅の内側に収まる（はみ出さない）", () => {
    renderPattern(container, SON_CLAVE);
    const svg = container.querySelector("svg")!;
    const logicalWidth = Number(svg.getAttribute("viewBox")!.split(" ")[2]);
    const staveEnds = [...svg.outerHTML.matchAll(/d="M[\d.]+ [\d.]+L([\d.]+) /g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.max(...staveEnds)).toBeLessThanOrEqual(logicalWidth);
  });

  it("再描画しても同じ音符に同じ要素が対応づく（ハイライトが壊れない）", () => {
    const first = renderPattern(container, SON_CLAVE);
    const idsFirst = [...first.noteElements.keys()].sort();

    const second = renderPattern(container, SON_CLAVE);
    const idsSecond = [...second.noteElements.keys()].sort();

    expect(idsSecond).toEqual(idsFirst);
    expect(container.querySelectorAll("svg")).toHaveLength(1); // 古い SVG が残らない
  });

  it("音符に色を付けても座標が動かない", () => {
    const { noteElements } = renderPattern(container, SON_CLAVE);
    const el = noteElements.get("sr1")!;
    const before = el.getAttribute("transform");

    el.classList.add("on");

    expect(el.getAttribute("transform")).toBe(before);
  });
});

describe("付点の描画", () => {
  /**
   * **付点は音価文字列とグリフの両方が要る。**
   * 片方だけだと小節の長さは合うのに付点が見えない、という壊れ方をする。
   *
   * VexFlow は付点を符頭グループの中に2つ目の `<text>` として描く。
   * 文字幅の測定に依らない構造の話なので jsdom でも検出できる。
   */
  const noteheadTextCounts = (pattern: Parameters<typeof renderPattern>[1]) => {
    renderPattern(container, pattern);
    return Array.from(container.querySelectorAll(".vf-stavenote")).map(
      (n) => n.querySelectorAll(".vf-notehead text").length,
    );
  };

  it("付点音符には付点のグリフが描かれる", () => {
    // カン(4分) カ(8分) カン(付点4分) が2小節。3つ目と6つ目に付点が付く
    expect(noteheadTextCounts(AFRO_GROOVE_6_8_2)).toEqual([1, 1, 2, 1, 1, 2]);
  });

  it("付点のないリズムには付点が描かれない", () => {
    expect(noteheadTextCounts(AFRO_GROOVE_6_8).every((n) => n === 1)).toBe(true);
  });
});
