import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.spec.js', '**/.claude/**'],
    setupFiles: ['./board/test/vitest.setup.js'],
  },
});
