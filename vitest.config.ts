import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['engine/test/**/*.test.ts', 'client/**/*.test.{ts,tsx}', 'sync/**/*.test.ts'],
    // Fili invece di processi: Node qui è quello di VS Code (programma a finestre) e ogni processo
    // figlio aprirebbe una finestra di terminale sul desktop
    pool: 'threads',
  },
});
