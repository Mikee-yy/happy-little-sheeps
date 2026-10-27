import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { build, defineConfig, type InlineConfig, type Plugin } from 'vite';

// Sito statico per GitHub Pages: percorsi relativi, così funziona con qualsiasi nome di repository.
// La scena 2,5D è un pacchetto a parte (import dinamico in client/src/partita/caricaScena.ts): nessun file supera i 500 kB.
// prova.html e scena.html restano solo per lo sviluppo.
const CLIENT = resolve(import.meta.dirname, 'client');

/**
 * Il banco di prova della scena (client/banco/index.html, la pagina di sviluppo da usare anche sul telefono) si pubblica
 * in dist/banco/ con una build tutta sua, dopo quella del gioco: il gioco resta identico (stessi file, stessi pezzi)
 * e il banco ha i suoi in dist/banco/assets/. Indirizzo nascosto: il gioco non lo nomina e la pagina non si fa indicizzare.
 */
export const CONFIG_BANCO: InlineConfig = {
  configFile: false,
  root: resolve(CLIENT, 'banco'),
  base: './',
  plugins: [react()],
  logLevel: 'warn',
  build: {
    outDir: resolve(CLIENT, 'dist/banco'),
    emptyOutDir: true,
    // Come per il gioco, nessun file oltre i 500 kB: le librerie (React) e il motore in pezzi a parte
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'librerie', test: /node_modules/ },
            { name: 'motore', test: /[\\/]engine[\\/]/ },
          ],
        },
      },
    },
  },
};

function bancoDiProva(): Plugin {
  return {
    name: 'banco-di-prova',
    apply: 'build',
    async closeBundle() {
      await build(CONFIG_BANCO);
    },
  };
}

export default defineConfig({
  root: 'client',
  base: './',
  plugins: [react(), bancoDiProva()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: { fs: { allow: ['..'] } },
});
