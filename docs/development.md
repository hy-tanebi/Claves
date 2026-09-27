# 開発

手元で動かす・検証するための手順です。

## セットアップ

```bash
pnpm install --frozen-lockfile
```

## 開発サーバー

```bash
pnpm dev
```

iPhone の Safari から開くときは、起動時に表示される `Network:` の URL を使います（同じ Wi-Fi にいること。IP は繋ぎ直すと変わります）。iOS は最初のタップまで音を出せないので、PLAY ボタンから始めてください。

## 検証

```bash
pnpm test             # JS のテスト（データの正しさ）
pnpm typecheck        # 型
pnpm test:e2e         # 画面の操作。pnpm dev を別ターミナルで起動してから
pnpm check:notation   # 譜面の見た目。同上
cd ios/ClavesEngine && swift test   # Swift のテスト
```

E2E は Chromium と WebKit の両方で流します。初回は `pnpm exec playwright install chromium webkit` が必要です。

`pnpm test` は譜面の見た目を保証しません。譜面や画面を変えたら `check:notation` を通し、`screenshots/` の画像を目で確認します。

## iOS へ反映

```bash
pnpm build && pnpm exec cap sync ios
open ios/App/App.xcodeproj
```

署名の Team ID は `ios/Signing.xcconfig`（git 管理外）に置きます。`ios/Signing.xcconfig.example` をコピーして作ってください。シミュレータ向けのビルドは署名なしで通ります。

## リズムを足す

`src/domain/patterns/` に 1 ファイル書いて `registry.ts` に登録し、`pnpm gen:golden` で fixture を作り直してから `check:notation` を通します。
