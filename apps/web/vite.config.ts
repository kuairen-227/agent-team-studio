import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // prefix="" で VITE_ 以外の変数も読む。これらは config 内のみで使用し
  // クライアントバンドルには含まれない。
  const env = loadEnv(mode, process.cwd(), "");

  const webPortStr = env.WEB_PORT;
  const webPort = webPortStr ? Number.parseInt(webPortStr, 10) : 5173;
  if (Number.isNaN(webPort) || webPort < 1 || webPort > 65535) {
    throw new Error(
      `WEB_PORT="${webPortStr}" は有効なポート番号ではありません（1〜65535）`,
    );
  }

  const apiPortStr = env.API_PORT;
  if (apiPortStr === "") {
    throw new Error("API_PORT が空文字です。apps/web/.env を確認してください");
  }
  const apiPort = apiPortStr ?? "3000";

  return {
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    server: {
      // DevContainer の port-forward 経由でホスト側ブラウザから到達できるよう
      // 全インターフェースに bind する（既定の IPv6 localhost のみだと外部から見えない）。
      host: true,
      port: webPort,
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
        "/ws": {
          target: `ws://localhost:${apiPort}`,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
