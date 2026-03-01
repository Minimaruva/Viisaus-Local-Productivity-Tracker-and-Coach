import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// In ESM vite configs, __dirname doesn't exist — derive it from import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Vite config for the React renderer process.
export default defineConfig({
  root: join(__dirname, 'src/renderer'),
  plugins: [react()],
  base: './',
  build: {
    outDir: join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    // Multi-page: main window + mini floating timer window.
    rollupOptions: {
      input: {
        main: join(__dirname, 'src/renderer/index.html'),
        mini: join(__dirname, 'src/renderer/mini.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
