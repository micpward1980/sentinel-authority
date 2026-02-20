import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  globalSetup: './tests/global-setup.js',
  use: {
    baseURL: 'https://app.sentinelauthority.org',
    headless: true,
    storageState: 'tests/.auth.json',
    screenshot: 'only-on-failure',
  },
});
