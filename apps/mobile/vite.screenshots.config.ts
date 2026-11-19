import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * ВРЕМЕННЫЙ конфиг только для съёмки стора-скриншотов (RuStore/Google Play).
 * Отличие от основного: клиент ходит на same-origin /api (VITE_API_URL не
 * пробрасывается в клиент через envPrefix), а Vite проксирует запросы на
 * прод https://stariva.ru без CORS. Не коммитить, удалить после съёмки.
 */
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  envPrefix: "MOBILE_SHOTS_",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    proxy: {
      "/api": {
        target: "https://stariva.ru",
        changeOrigin: true,
      },
    },
  },
  build: { outDir: "dist", target: "es2022" },
});
