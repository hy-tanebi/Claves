import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    // LAN 上の実機（iPhone）から開けるようにする。開発時のみ
    host: true,
    // IP が変わっても迷わないよう、起動時に接続先を全部出す
    open: false,
  },
  test: {
    globals: true,
    environment: "node",
  },
});
