import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Sito statico per GitHub Pages: percorsi relativi, così funziona con qualsiasi nome di repository.
export default defineConfig({
  root: 'client',
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: { fs: { allow: ['..'] } },
});
