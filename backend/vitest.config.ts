import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Each test file creates its own database; keep the pool of files small.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
