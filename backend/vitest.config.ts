import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://smartfin:smartfin@localhost:5432/smartfin_test',
      JWT_SECRET: 'test-secret',
      PAYMENT_WEBHOOK_SECRET: 'test-webhook',
    },
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 30000,
  },
});
