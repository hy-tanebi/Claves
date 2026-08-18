# リズムパターン・メトロノーム

ブラジルのリズム（サンバヘギ／サンバアフロ／カンドンブレ系）の骨格タイムラインを
鳴らす練習用メトロノーム。

## 開発サーバーを起動する

```bash
pnpm dev
```

**iPhone から開くとき**は、起動時に表示される `Network:` の URL を使う。

```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.x.x:5173/   ← これを iPhone の Safari で開く
```

- Mac と iPhone が**同じ Wi-Fi** にいること
- **Network の IP は Wi-Fi に繋ぎ直すと変わることがある。** 開かないときは
  サーバーを再起動して、表示された新しい URL を使う
- iOS は最初のタップまで音を出せないので、必ず「再生」ボタンから始める

## その他のコマンド

```bash
pnpm test        # テスト
pnpm typecheck   # 型チェック
```
