import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  workers: 1,
  webServer: {
    command: 'npx serve test/tmp -l 4173 --no-clipboard',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
