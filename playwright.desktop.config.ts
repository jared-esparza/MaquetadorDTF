import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/desktop',
  workers: 1,
  timeout: 60000,
  expect: { timeout: 12000 },
  outputDir: 'desktop-test-results',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
