import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    exclude: ['**/dist/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*'],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**', 'src/**/*.vue', 'src/**/*.sql', 'src/**/*.css', 'src/**/*.json'],
    },
  },
});
