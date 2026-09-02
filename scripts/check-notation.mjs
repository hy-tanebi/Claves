/**
 * 実ブラウザで譜面の見た目を検証し、スクリーンショットを撮る。
 *
 * なぜ必要か:
 *   jsdom は canvas を持たないため VexFlow が文字幅を測れず、
 *   配置計算が実ブラウザと別物になる。
 *   jsdom のテストは「データの正しさ」までしか保証できない。
 *   見た目は必ずここで確認する。
 *
 * 使い方:
 *   pnpm dev              （別のターミナルで開発サーバーを起動）
 *   pnpm check:notation   （このスクリプト）
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = process.env.APP_URL ?? "http://localhost:5173/";
const WIDTHS = [375, 390, 430];
const OUT = "screenshots";

/** SVG テキストの判定枠はグリフの送り幅を含み、実際のインクより広い */
const BBOX_TOLERANCE_PX = 6;

/** 符頭がこれより小さいと読めない */
const MIN_NOTEHEAD_PX = 6;

/**
 * 符頭の大きさの既知の例外。**足すときは必ずオーナーの判断を通すこと。**
 *
 * ここに書いたぶんだけ検査が緩む。**「落ちたままにする」のは禁じ手。**
 * 赤いままの検査は「いつものやつ」になり、本当の退行を見逃す原因になる。
 * 許容すると決めたなら、測った値をここに残して緑に戻す。
 *
 * 値は「これ以上小さくなったら落とす」線。実測値よりわずかに小さくしてあるので、
 * **さらに縮んだら気づける。**
 */
const NOTEHEAD_ALLOWANCE = {
  // Afro Groove3 は12要素（9打点＋3休符）で、他のリズム（8〜10要素）より密。
  // 段の幅は全パターン共通の固定値なので、そのぶん縮む。
  // 375pt（iPhone SE / mini）でだけ 6px を下回る。実測 5.7px。
  // 譜面そのものは正しく描けている（符尾の離れ・見切れ・重なりは 0）。
  // 2026-09-02 オーナー判断でこのまま出す。
  "Afro Groove3": { 375: 5.6 },
};

function minNoteheadPx(name, width) {
  return NOTEHEAD_ALLOWANCE[name]?.[width] ?? MIN_NOTEHEAD_PX;
}

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
let failed = false;

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
  try {
    await page.goto(URL, { waitUntil: "networkidle" });
  } catch {
    console.error(`開発サーバーに接続できません: ${URL}\n先に別のターミナルで pnpm dev を実行してください`);
    await browser.close();
    process.exit(1);
  }
  // 音楽フォントの読み込みを待つ。待たずに測ると幅がずれる
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // **収録リズムを1つずつ表示して検証する。**
  // 既定表示の1つだけを見ていると、あとから追加したリズムの崩れを見逃す。
  const items = page.locator("#patternList .sheetItem");
  const names = await items.evaluateAll((els) =>
    // 行は「名前」と「譜面」の2段
    els.map((el) => el.querySelector(".sheetName")?.textContent ?? "?"),
  );

  for (let pi = 0; pi < names.length; pi++) {
    if (pi > 0) {
      await page.click("#patternPicker");
      await items.nth(pi).click();
      await page.waitForTimeout(300);
    }

  const result = await page.evaluate((tolerance) => {
    const svg = document.querySelector(".score svg");
    if (!svg) return { error: "譜面が描かれていない" };

    // 譜表は1本線なので「五線の高さ」は測れない。
    // 譜面の大きさは符頭の幅で見る（インクを canvas で測る）
    const inkCtx = document.createElement("canvas").getContext("2d");
    const inkOf = (el) => {
      const size = Number(el.getAttribute("font-size"));
      const y = Number(el.getAttribute("y"));
      if (!Number.isFinite(size) || !Number.isFinite(y)) return null;
      inkCtx.font = `${size}px Bravura`;
      const m = inkCtx.measureText(el.textContent ?? "");
      return { top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent,
               width: m.width };
    };
    const staves = [...svg.querySelectorAll(".vf-stave")].map((e) => e.getBoundingClientRect());
    const notes = [...svg.querySelectorAll(".vf-stavenote")].map((e) => e.getBoundingClientRect());

    const outside = notes.filter(
      (n) => !staves.some((s) => n.left >= s.left - tolerance && n.right <= s.right + tolerance),
    ).length;

    const sorted = [...notes].sort((a, b) => a.left - b.left);
    let overlap = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].left < sorted[i - 1].right - 1) overlap++;
    }

    // 符尾が符頭に接続しているか。
    // VexFlow は描画時に文字幅を測って符尾の位置を決めるため、
    // 音楽フォントの読み込み前に描くと代替フォントの幅で計算し、
    // 符尾が符頭から離れる。見た目で最も気づきやすい壊れ方なのに
    // 座標だけ見ていると見逃すので、必ず機械で判定する。
    let detachedStems = 0;
    for (const note of svg.querySelectorAll(".vf-stavenote")) {
      const head = note.querySelector(".vf-notehead text");
      const stem = note.querySelector(".vf-stem path");
      if (!head || !stem) continue;
      const h = head.getBoundingClientRect();
      const s = stem.getBoundingClientRect();
      if (Math.abs(s.left - h.right) > 3) detachedStems++;
    }

    // 見切れ検出：描かれた内容が viewBox の縦範囲に収まっているか。
    //
    // **テキストは枠ではなくインクで測る。** SVG テキストの枠は
    // 音楽フォントの巨大な行送りを含み、実際の5倍近くになるため、
    // 枠で判定すると常に見切れ扱いになって役に立たない。
    const vb = svg.getAttribute("viewBox").split(" ").map(Number);
    const vbTop = vb[1];
    const vbBottom = vb[1] + vb[3];
    let clipped = 0;

    for (const path of svg.querySelectorAll("path")) {
      const d = path.getAttribute("d") ?? "";
      for (const m of d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)) {
        const y = Number(m[2]);
        if (y < vbTop - 0.5 || y > vbBottom + 0.5) clipped++;
      }
    }
    for (const rect of svg.querySelectorAll("rect")) {
      const y = Number(rect.getAttribute("y"));
      const h = Number(rect.getAttribute("height"));
      if (!Number.isFinite(y) || !Number.isFinite(h)) continue;
      if (y < vbTop - 0.5 || y + h > vbBottom + 0.5) clipped++;
    }
    for (const text of svg.querySelectorAll("text")) {
      const ink = inkOf(text);
      if (!ink) continue;
      if (ink.top < vbTop - 0.5 || ink.bottom > vbBottom + 0.5) clipped++;
    }

    const heads = [...svg.querySelectorAll(".vf-notehead text")].map(inkOf).filter(Boolean);
    const svgScale = svg.getBoundingClientRect().width / vb[2];
    const noteheadPx = heads.length ? +(heads[0].width * svgScale).toFixed(1) : null;
    // 5線のうち中央だけを表示している。描かれる path の本数で数える
    const staffLines = svg.querySelectorAll(".vf-stave path").length / staves.length;

    const doc = document.documentElement;
    return {
      clippedElements: clipped,
      staffLinesPerBar: staffLines,
      noteheadPx,
      systems: new Set(staves.map((s) => Math.round(s.top))).size,
      bars: staves.length,
      notesOutsideBar: outside,
      overlappingNotes: overlap,
      detachedStems,
      horizontalScroll: doc.scrollWidth > doc.clientWidth,
      verticalScroll: doc.scrollHeight > window.innerHeight,
    };
  }, BBOX_TOLERANCE_PX);

  const slug = names[pi].replace(/[^\w.-]+/g, "_");
  await page.screenshot({ path: `${OUT}/app-${width}-${slug}.png` });

  const problems = [];
  const notes = [];
  if (result.error) problems.push(result.error);
  if (result.clippedElements > 0)
    problems.push(`SVG の表示範囲から見切れている要素（${result.clippedElements}件）— viewBox の高さが足りない`);
  if (result.detachedStems > 0)
    problems.push(`符尾が符頭から離れている（${result.detachedStems}件）— 音楽フォントの読み込み前に描いていないか確認`);
  if (result.overlappingNotes > 0) problems.push(`音符が重なっている（${result.overlappingNotes}件）`);
  if (result.notesOutsideBar > 0) problems.push(`小節からはみ出した音符（${result.notesOutsideBar}件）`);
  if (result.horizontalScroll) problems.push("横スクロールが発生している");
  const floor = minNoteheadPx(names[pi], width);
  if (result.noteheadPx !== null && result.noteheadPx < floor)
    problems.push(
      `音符が小さすぎる（符頭 ${result.noteheadPx}px、下限 ${floor}px）`,
    );
  // 例外に書いた組み合わせは、緩めていることを毎回言う。黙って緩めない
  else if (floor !== MIN_NOTEHEAD_PX)
    notes.push(
      `符頭 ${result.noteheadPx}px（既知の例外として ${floor}px まで許容している）`,
    );
  if (result.staffLinesPerBar !== 1)
    problems.push(`譜表が1本線になっていない（${result.staffLinesPerBar}本）`);

  const mark = problems.length === 0 ? "OK " : "NG ";
  console.log(`${mark}${width}px  ${names[pi]}  ${JSON.stringify(result)}`);
  for (const p of problems) console.log(`     - ${p}`);
  for (const n of notes) console.log(`     * ${n}`);
  if (problems.length > 0) failed = true;
  }

  await page.close();
}

await browser.close();
console.log(`\nスクリーンショット: ${OUT}/`);
process.exit(failed ? 1 : 0);
