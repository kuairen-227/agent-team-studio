import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// 未設定（undefined）はデフォルト値を使い、空文字・NaN・範囲外は設定不備として即 throw する。
// Number.parseInt を使うため "80abc" → 80 の素通りは許容する（.env での発生は非現実的）。
function parsePort(
  raw: string | undefined,
  fallback: number,
  name: string,
): number {
  if (raw === undefined) return fallback;
  const port = Number.parseInt(raw, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(
      `${name}="${raw}" は有効なポート番号ではありません（1〜65535）`,
    );
  }
  return port;
}

export default defineConfig(({ mode }) => {
  // prefix="" で VITE_ 以外の変数も読む。これらは config 内のみで使用し
  // クライアントバンドルには含まれない。
  const env = loadEnv(mode, process.cwd(), "");

  const apiPort = parsePort(env.API_PORT, 3000, "API_PORT");
  const webPort = parsePort(env.WEB_PORT, 5173, "WEB_PORT");

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
