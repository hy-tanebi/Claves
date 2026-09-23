/**
 * E2E の共通部品。実ブラウザ（Playwright の Chromium）でアプリを開く。
 *
 * なぜ Vitest ではなくここか:
 *   Vitest は jsdom で動くため、押す・離す・長押し・レイアウトを実物どおりに再現できない。
 *   実際の画面の振る舞いはここで確かめる。
 *
 * 使い方:
 *   pnpm dev          （別のターミナルで開発サーバーを起動）
 *   pnpm test:e2e     （e2e/ 以下のテストをすべて流す）
 */
import { chromium } from "playwright";

export const APP_URL = process.env.APP_URL ?? "http://localhost:5174/";

/** index.html の <title>。開いたのが Claves かどうかをこれで見分ける */
const APP_TITLE = "Clavenome — Rhythm Metronome";

/** 実機に近い大きさで撮る。幅だけ変えて見るときは openApp の引数で渡す */
const DEFAULT_VIEWPORT = { width: 390, height: 844 };

export async function launchBrowser() {
  return chromium.launch();
}

/**
 * アプリを開き、描画が落ち着くまで待つ。
 * 開けなければ「サーバーが無い」と分かるように落とす
 * （タイムアウトで落ちると原因が読めない）。
 */
export async function openApp(browser, viewport = DEFAULT_VIEWPORT) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  // 要素が無いとき既定では 30 秒待ってから落ちる。画面の操作は一瞬で済むので短くする
  page.setDefaultTimeout(3000);
  const errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });

  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
  } catch {
    await page.close();
    throw new Error(
      `開発サーバーに接続できません: ${APP_URL}\n先に別のターミナルで pnpm dev を実行してください`,
    );
  }
  // **別のプロジェクトの dev サーバーを開いていないか確かめる。**
  // Claves は 5174 に固定している（vite.config.ts）が、APP_URL を取り違えたり
  // 別のアプリがその番号を使っていたりすると、気づかずに進んで「要素が無い」で全部落ち、
  // 原因を取り違える（2026-09-23 に 5173 の swipe-wiki を開いて起きた）
  const title = await page.title();
  if (title !== APP_TITLE) {
    await page.close();
    throw new Error(
      `${APP_URL} は Claves ではありません（title: "${title}"）\n` +
        "Claves で pnpm dev を起動し、表示された URL を APP_URL で渡してください\n" +
        "例: APP_URL=http://localhost:5174/ pnpm test:e2e（5174 が既定）",
    );
  }
  // 音楽フォントの読み込みを待つ。待たずに測ると配置がずれる
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  return { page, errors };
}

/** いま表示されている BPM */
export async function readBpm(page) {
  return Number(await page.locator("#bpmValue").textContent());
}

/** スライダーを指で動かしたのと同じ扱いにする（input イベントを出す） */
export async function setSlider(page, value) {
  await page.locator("#bpm").evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

/** 要素の真ん中を押したまま ms 待って離す。ms = 0 なら1回押し */
export async function press(page, selector, ms = 0) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} が画面に無い`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  if (ms > 0) await page.waitForTimeout(ms);
  await page.mouse.up();
}

/**
 * 一定の間隔で count 回叩く（タップテンポ用）。
 *
 * 1打ごとに press() を呼ぶと、位置を測ってマウスを動かす時間（10ms 前後）が
 * 間隔に上乗せされ、BPM が低く出る（400ms 間隔で 146 になった）。
 * マウスは最初に1回だけ動かし、打つ時刻を「開始から intervalMs × n」に合わせる。
 */
export async function tapAtInterval(page, selector, intervalMs, count) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} が画面に無い`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  const start = performance.now();
  for (let i = 0; i < count; i++) {
    const wait = start + i * intervalMs - performance.now();
    if (wait > 0) await page.waitForTimeout(wait);
    await page.mouse.down();
    await page.mouse.up();
  }
}
