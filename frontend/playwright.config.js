import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'https://app.sentinelauthority.org',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
