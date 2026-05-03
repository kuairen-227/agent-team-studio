import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Walking Skeleton (#82) のため `/api`, `/ws` を apps/api (:3000) に転送する。
 * `ws: true` を付けると WebSocket Upgrade も同経路で透過される。
 *
 * 本設定の前提: apps/api が `bun --watch src/index.ts` で同一ホストの :3000 に
 * 立ち上がっていること。dev container では compose で :3000 を公開しているため
 * `localhost:3000` で到達できる（docs/guides/devcontainer.md）。
 */
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
