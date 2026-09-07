import { describe, expect, it } from "vitest";
import { canFlip, flipPattern } from "./flip";
import { PATTERNS } from "./registry";
import { SON_CLAVE } from "./patterns/son-clave";
import { toPlaybackEvents } from "./derive";
import { validatePattern } from "./validate";
import { totalTicks } from "./ticks";

const noteIds = (p: ReturnType<typeof flipPattern>): string[] =>
  p.bars.flatMap((b) => b.items.filter((i) => i.kind === "note").map((i) => i.id));

describe("3:2 と 2:3 の入れ替え", () => {
  it("小節の順番が入れ替わる", () => {
    const flipped = flipPattern(SON_CLAVE);

    expect(flipped.bars).toHaveLength(2);
    // 小節の中身（音価と休符の並び）は、元の後半・前半の順になる
    const shape = (bar: (typeof flipped.bars)[number]) =>
      bar.items.map((i) => `${i.kind}:${i.duration}${i.dots ? "." : ""}`).join(",");

    expect(shape(flipped.bars[0]!)).toBe(shape(SON_CLAVE.bars[1]!));
    expect(shape(flipped.bars[1]!)).toBe(shape(SON_CLAVE.bars[0]!));
  });

  /**
   * **これが一番大事なテスト。**
   * id が元と重なると、再生中に切り替えたとき `switchingIds` が元の打点にも当たり、
   * 譜面が音より早く切り替わる（2026-08-22 に直した不具合の再発）。
   */
  it("打点の id が元のリズムと1つも重ならない", () => {
    const original = new Set(noteIds(SON_CLAVE));
    const flipped = noteIds(flipPattern(SON_CLAVE));

    expect(flipped).toHaveLength(original.size);
    for (const id of flipped) {
      expect(original.has(id)).toBe(false);
    }
  });

  it("打点の id が反転したパターンの中で重複しない", () => {
    const ids = noteIds(flipPattern(SON_CLAVE));
    expect(new Set(ids).size).toBe(ids.length);
  });

  /** 収録リズムのどれとも衝突しないこと（一覧から選んだ曲と混ざらない） */
  it("打点の id が他の収録リズムとも重ならない", () => {
    const others = new Set(PATTERNS.flatMap(noteIds));
    for (const id of noteIds(flipPattern(SON_CLAVE))) {
      expect(others.has(id)).toBe(false);
    }
  });

  /** 同じリズムを別の半分から始めているだけ。収録が増えるわけではない */
  it("リズムの id と名前は変わらない", () => {
    const flipped = flipPattern(SON_CLAVE);
    expect(flipped.id).toBe(SON_CLAVE.id);
    expect(flipped.name).toBe(SON_CLAVE.name);
  });

  it("1周期の長さが変わらない", () => {
    expect(totalTicks(flipPattern(SON_CLAVE))).toBe(totalTicks(SON_CLAVE));
  });

  it("打点の数が変わらない", () => {
    expect(toPlaybackEvents(flipPattern(SON_CLAVE))).toHaveLength(
      toPlaybackEvents(SON_CLAVE).length,
    );
  });

  /** 反転したものも、収録リズムと同じ検査を通らなければならない */
  it("バリデータが誤りを出さない", () => {
    expect(validatePattern(flipPattern(SON_CLAVE))).toEqual([]);
  });

  it("2回入れ替えると元に戻る（打点の並び）", () => {
    const twice = flipPattern(flipPattern(SON_CLAVE));
    const ticks = (p: typeof SON_CLAVE) => toPlaybackEvents(p).map((e) => e.tick);
    expect(ticks(twice)).toEqual(ticks(SON_CLAVE));
  });
});

describe("入れ替えができるリズムの判定", () => {
  /**
   * **id を並べて固定しない。** 収録が増えるたびに書き換えることになり、
   * 書き換えるついでに増やしてよい印になってしまう。
   * 「`clave` が立っているものだけが入れ替えられる」という規則を固定する
   */
  it("clave を持つリズムだけが入れ替えられる", () => {
    for (const p of PATTERNS) {
      expect(canFlip(p)).toBe(p.clave === "3-2" && p.bars.length === 2);
    }
  });

  /** 印が付いているリズムが1つも無くなったら、ボタンが死んでいることに気づけない */
  it("入れ替えられるリズムが少なくとも1つある", () => {
    expect(PATTERNS.filter(canFlip).length).toBeGreaterThan(0);
  });

  /**
   * **`clave` は根拠のあるものにだけ立てる。**
   * 印が付いているリズムには、必ず出典の記録があること
   */
  it("clave を持つリズムには出典の記録がある", () => {
    for (const p of PATTERNS.filter((x) => x.clave)) {
      expect(p.source.confirmedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.source.arrangementNotes ?? "").toContain("クラーベ");
    }
  });
});
