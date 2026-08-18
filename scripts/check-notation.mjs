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

  const result = await page.evaluate((tolerance) => {
    const svg = document.querySelector(".score svg");
    if (!svg) return { error: "譜面が描かれていない" };

    const lines = [...svg.querySelectorAll(".vf-stave path")]
      .slice(0, 5)
      .map((e) => e.getBoundingClientRect().y);
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

    const doc = document.documentElement;
    return {
      staffHeight: +(lines[4] - lines[0]).toFixed(1),
      systems: new Set(staves.map((s) => Math.round(s.top))).size,
      bars: staves.length,
      notesOutsideBar: outside,
      overlappingNotes: overlap,
      horizontalScroll: doc.scrollWidth > doc.clientWidth,
      verticalScroll: doc.scrollHeight > window.innerHeight,
    };
  }, BBOX_TOLERANCE_PX);

  await page.screenshot({ path: `${OUT}/app-${width}.png` });

  const problems = [];
  if (result.error) problems.push(result.error);
  if (result.overlappingNotes > 0) problems.push(`音符が重なっている（${result.overlappingNotes}件）`);
  if (result.notesOutsideBar > 0) problems.push(`小節からはみ出した音符（${result.notesOutsideBar}件）`);
  if (result.horizontalScroll) problems.push("横スクロールが発生している");
  if (result.staffHeight < 18) problems.push(`五線が小さすぎる（${result.staffHeight}px）`);

  const mark = problems.length === 0 ? "OK " : "NG ";
  console.log(`${mark}${width}px  ${JSON.stringify(result)}`);
  for (const p of problems) console.log(`     - ${p}`);
  if (problems.length > 0) failed = true;

  await page.close();
}

await browser.close();
console.log(`\nスクリーンショット: ${OUT}/`);
process.exit(failed ? 1 : 0);
