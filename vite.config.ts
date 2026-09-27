import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    // LAN 上の実機（iPhone）から開けるようにする。開発時のみ
    host: true,
    // IP が変わっても迷わないよう、起動時に接続先を全部出す
    open: false,
    // **5174 に固定する。** 5173 は他のプロジェクトが使う。
    // host: true だと IPv4 側で 5173 が取れてしまい、localhost（IPv6 が先）を開くと
    // 相手のアプリが出る。空いていなければ別の番号に逃げず、起動を失敗させる
    port: 5174,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: "node",
    // e2e/ は実ブラウザで流す別のテスト（node:test + Playwright）。pnpm test:e2e で実行する
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
