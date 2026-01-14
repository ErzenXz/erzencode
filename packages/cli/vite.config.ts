import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/web-ui'),
  build: {
    outDir: path.resolve(__dirname, 'dist/web-ui'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/web-ui/index.html'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/web-ui'),
    },
  },
});
