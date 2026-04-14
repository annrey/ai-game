import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    testTimeout: 120_000,
    setupFiles: ['./packages/core/src/test/setup.ts'],
    include: ['packages/*/src/**/__tests__/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/**/__tests__/**',
        'packages/core/src/test/**',
        'packages/core/src/demo*.ts',
        'packages/core/src/test-*.ts',
        'apps/server/src/server.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 55,
      },
    },
  },
});
