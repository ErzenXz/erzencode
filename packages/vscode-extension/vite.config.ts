import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/settings",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        settings: resolve(__dirname, "src/webview/settings/index.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/webview/settings"),
    },
  },
});
