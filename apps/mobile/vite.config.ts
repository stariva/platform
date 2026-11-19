import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
  // Относительные пути: бандл открывается из файлов приложения, а не с корня
  // сайта, и распаковывается Capgo в произвольную папку
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  define: {
    // Версия веб-бандла = version из package.json. По ней приложение узнаёт,
    // что вшитый бандл уже последний (см. src/lib/updates.ts)
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    // В разработке API сайта проксируется, чтобы cookie сессии были «свои»
    proxy: { "/api": process.env.VITE_API_URL ?? "http://localhost:3000" },
  },
  build: { outDir: "dist", target: "es2022" },
});
