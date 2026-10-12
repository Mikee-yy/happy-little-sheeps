import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['engine/test/**/*.test.ts', 'client/**/*.test.{ts,tsx}', 'sync/**/*.test.ts'],
  },
});
