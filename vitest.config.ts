import { defineConfig } from 'vitest/config';

const shared = {
  exclude: ['**/node_modules/**', '**/coverage/**'],
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['{apps,packages,scripts}/**/*.test.ts', '*.test.ts'],
          exclude: [...shared.exclude, '**/*.emulator.test.ts'],
        },
      },
      {
        test: {
          name: 'emulator',
          include: ['{apps,packages,scripts,firebase}/**/*.emulator.test.ts'],
          exclude: shared.exclude,
          setupFiles: ['scripts/require-emulator.ts'],
          // One Firestore emulator is shared, so emulator test files run one at a time.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/fixtures/**', '**/node_modules/**'],
      reporter: ['text-summary', 'text', 'json-summary'],
      thresholds: {
        // docs/workflow.md: packages/core stays above 90% of lines.
        'packages/core/**': { lines: 90 },
      },
    },
  },
});
