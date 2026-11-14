import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    // В разработке API сайта проксируется, чтобы cookie сессии были «свои»
    proxy: { "/api": process.env.VITE_API_URL ?? "http://localhost:3000" },
  },
  build: { outDir: "dist", target: "es2022" },
});
