import path from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve(__dirname, "src/web-ui"),
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: process.env.CODING_CLI_BACKEND_URL ?? "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/web-ui"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/web-ui"),
    emptyOutDir: true,
  },
});
