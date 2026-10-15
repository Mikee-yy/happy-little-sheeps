import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Sito statico per GitHub Pages: percorsi relativi, così funziona con qualsiasi nome di repository.
// La scena 2,5D è un pacchetto a parte (import dinamico in client/src/partita/caricaScena.ts): nessun file supera i 500 kB.
export default defineConfig({
  root: 'client',
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: { fs: { allow: ['..'] } },
});
