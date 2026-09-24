/**
 * App Store 用スクリーンショット。**dist/ を Playwright の route で直接配るので、サーバーは立てない。**
 *
 * 使い方: pnpm build && node scripts/store-screenshots.mjs
 * 出力: screenshots/store/{67,65}-*.png（6.7インチ 1290×2796 / 6.5インチ 1284×2778）
 */
import { chromium } from "playwright";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";

const DIST = process.env.DIST ?? "dist";
const OUT = process.env.OUT ?? "screenshots/store";
mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };

// 6.7" (1290×2796) と 6.5" (1284×2778)。CSS px × 3
const SIZES = [
  { tag: "67", w: 430, h: 932 },
  { tag: "65", w: 428, h: 926 },
];

const browser = await chromium.launch();
for (const { tag, w, h } of SIZES) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    let p = u.pathname === "/" ? "/index.html" : u.pathname;
    const f = join(DIST, p);
    if (!existsSync(f)) return route.fulfill({ status: 404, body: "" });
    route.fulfill({ status: 200, contentType: MIME[extname(f)] ?? "application/octet-stream", body: readFileSync(f) });
  });
  await page.goto("http://app.local/", { waitUntil: "networkidle" });
  // 起動時の状態バーぶんの余白を iOS に合わせる（safe-area は WebView 外では 0）
  await page.evaluate(() => { document.getElementById("app").style.paddingTop = "59px"; });
  await page.waitForTimeout(800);

  const pick = async (name) => {
    await page.click("#patternPicker");
    await page.waitForTimeout(300);
    await page.click(`#patternList button:has-text("${name}")`);
    await page.waitForTimeout(800);
  };

  // 1. Son Clave（初期）
  await page.screenshot({ path: `${OUT}/${tag}-1-son-clave.png` });
  // 2. リズム一覧を開いた状態
  await page.click("#patternPicker");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${tag}-2-list.png` });
  await page.click("#patternClose");
  await page.waitForTimeout(300);
  // 3. 6/8 のリズム
  await pick("6/8 Afro Groove 1");
  await page.screenshot({ path: `${OUT}/${tag}-3-6-8.png` });
  // 4. IJEXA
  await pick("IJEXA");
  await page.screenshot({ path: `${OUT}/${tag}-4-ijexa.png` });
  await page.close();
}
await browser.close();
console.log("done");
