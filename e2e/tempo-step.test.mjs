/**
 * テンポ ±1 ボタンの E2E。
 *
 * 1 BPM ずつ合わせるためのボタン。スライダーは 1 BPM が約 1.7px しかなく、
 * TAP も叩いた間隔から出すので数 BPM ずれる。その隙間を埋める。
 *
 * タイマーの厳密な時間（400ms で連続開始、80ms 間隔）は単体テスト
 * （src/press-repeat.test.ts）が守る。ここでは「利用者から見てそう動くか」を見る。
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { launchBrowser, openApp, press, readBpm, setSlider, tapAtInterval } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
});

/** 1テストごとに新しいページで開く。BPM は保存されないので毎回 120 から始まる */
async function withApp(fn, viewport) {
  const { page, errors } = await openApp(browser, viewport);
  try {
    await fn(page, errors);
  } finally {
    await page.close();
  }
}

describe("テンポ ±1 ボタン", () => {
  it("− / TAP / + が左から順に同じ行に並ぶ", () =>
    withApp(async (page) => {
      const down = await page.locator("#bpmDown").boundingBox();
      const tap = await page.locator("#tap").boundingBox();
      const up = await page.locator("#bpmUp").boundingBox();
      assert.ok(down && tap && up, "3つとも画面にある");
      assert.ok(down.x + down.width <= tap.x, "− は TAP の左");
      assert.ok(tap.x + tap.width <= up.x, "+ は TAP の右");
      const mid = (b) => b.y + b.height / 2;
      assert.ok(Math.abs(mid(down) - mid(tap)) < 2 && Math.abs(mid(up) - mid(tap)) < 2, "同じ行");
    }));

  it("1回押すと1だけ動き、スライダーも追従する", () =>
    withApp(async (page) => {
      assert.equal(await readBpm(page), 120);
      await press(page, "#bpmUp");
      assert.equal(await readBpm(page), 121);
      assert.equal(await page.locator("#bpm").inputValue(), "121");
      await press(page, "#bpmDown");
      assert.equal(await readBpm(page), 120);
      assert.equal(await page.locator("#bpm").inputValue(), "120");
    }));

  it("押し続けると連続で動き、離すと止まる", () =>
    withApp(async (page) => {
      await press(page, "#bpmUp", 1000);
      const released = await readBpm(page);
      // 1回押しなら 121。連続で動いていれば明らかにそれより大きい
      assert.ok(released >= 125, `連続で増えている（${released}）`);
      await page.waitForTimeout(500);
      assert.equal(await readBpm(page), released, "離した後は動かない");
    }));

  it("上限 240 では + が押せず、押しても変わらない", () =>
    withApp(async (page) => {
      await setSlider(page, 240);
      assert.equal(await page.locator("#bpmUp").isDisabled(), true);
      assert.equal(await page.locator("#bpmDown").isDisabled(), false);
      await press(page, "#bpmUp");
      assert.equal(await readBpm(page), 240);
    }));

  it("下限 40 では − が押せず、押しても変わらない", () =>
    withApp(async (page) => {
      await setSlider(page, 40);
      assert.equal(await page.locator("#bpmDown").isDisabled(), true);
      assert.equal(await page.locator("#bpmUp").isDisabled(), false);
      await press(page, "#bpmDown");
      assert.equal(await readBpm(page), 40);
    }));

  it("長押しで上限に着いたら止まり、押下の見た目も残らない", () =>
    withApp(async (page) => {
      await setSlider(page, 236);
      // **iOS の条件で押す。** iOS はタップでボタンにフォーカスを移さない。
      // マウスで押すとフォーカスが移り、ボタンが無効になった瞬間の blur で色が消えるので、
      // 「明示的に色を外していない」欠陥を見逃す（実際に見逃した）。
      // pointerdown だけを直接送り、フォーカスも pointerup も与えない
      await page.locator("#bpmUp").dispatchEvent("pointerdown", {
        isPrimary: true,
        button: 0,
        pointerType: "touch",
      });
      await page.waitForTimeout(1200);
      assert.equal(await readBpm(page), 240);
      assert.equal(await page.locator("#bpmUp").isDisabled(), true);
      // 無効になったボタンには pointerup が届かないことがある。それでも押したままの色を残さない
      assert.notEqual(await page.locator("#bpmUp").getAttribute("data-pressed"), "true");
    }));

  it("キーボードの Enter と Space でも1ずつ動く", () =>
    withApp(async (page) => {
      await page.locator("#bpmUp").focus();
      await page.keyboard.press("Enter");
      assert.equal(await readBpm(page), 121);
      await page.keyboard.press("Space");
      assert.equal(await readBpm(page), 122);
      await page.locator("#bpmDown").focus();
      await page.keyboard.press("Enter");
      assert.equal(await readBpm(page), 121);
    }));

  it("± を押したら TAP の記録を捨てる（次の1打で値が飛ばない）", () =>
    withApp(async (page) => {
      // 400ms 間隔で叩いて 150 付近にする
      await tapAtInterval(page, "#tap", 400, 3);
      await press(page, "#bpmUp");
      const adjusted = await readBpm(page);
      await page.waitForTimeout(400);
      // 記録が残っていると、この1打と前の打点の間隔から値が出てしまう
      await press(page, "#tap");
      assert.equal(await readBpm(page), adjusted);
    }));

  it("再生中に押しても止まらず、エラーも出ない", () =>
    withApp(async (page, errors) => {
      await page.locator("#play").click();
      await page.waitForTimeout(300);
      assert.equal(await page.locator("#play").textContent(), "STOP");
      await press(page, "#bpmUp");
      await press(page, "#bpmUp", 800);
      await page.waitForTimeout(300);
      assert.equal(await page.locator("#play").textContent(), "STOP");
      assert.deepEqual(errors, []);
      await page.locator("#play").click();
    }));
});

describe("既存のテンポ操作（回帰）", () => {
  it("TAP を 400ms 間隔で叩くと 150 付近になる", () =>
    withApp(async (page) => {
      await tapAtInterval(page, "#tap", 400, 4);
      const bpm = await readBpm(page);
      assert.ok(Math.abs(bpm - 150) <= 3, `150 付近（${bpm}）`);
    }));

  it("スライダーを動かすと表示が追従する", () =>
    withApp(async (page) => {
      await setSlider(page, 97);
      assert.equal(await readBpm(page), 97);
    }));
});

describe("レイアウト", () => {
  mkdirSync("screenshots", { recursive: true });

  for (const width of [375, 390, 430]) {
    it(`${width}px: ± は指で押せる幅があり、BPM の数字が TAP 面に収まる`, () =>
      withApp(
        async (page) => {
          const down = await page.locator("#bpmDown").boundingBox();
          const up = await page.locator("#bpmUp").boundingBox();
          const tap = await page.locator("#tap").boundingBox();
          const digits = await page.locator("#tap .bpmRow").boundingBox();
          assert.ok(down && up && tap && digits);
          assert.ok(down.width >= 44 && up.width >= 44, `± の幅 ${down.width} / ${up.width}`);
          assert.ok(tap.width > digits.width, `TAP 面 ${tap.width} > 数字 ${digits.width}`);
          // 目で見る用。数字は3桁（最大幅）にしておく
          await setSlider(page, 240);
          await page.screenshot({ path: `screenshots/tempo-${width}.png` });
        },
        { width, height: 844 },
      ));
  }
});
