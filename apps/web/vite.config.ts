import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.API_PORT ?? "3000";
  const webPort = Number(env.WEB_PORT ?? 5173);

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
