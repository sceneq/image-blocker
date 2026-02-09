import { test as base, expect, firefox, type BrowserContext } from '@playwright/test';
import { withExtension } from 'playwright-webextext';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const DEV_ONNX_MODEL_ID = 'dev-onnx-komondor';

export const test = base.extend<{
  extensionContext: BrowserContext;
  seedSettings: (settings: any) => Promise<void>;
}>({
  // eslint-disable-next-line no-empty-pattern
  extensionContext: async ({}, use) => {
    const ext = withExtension(firefox, DIST);
    const browser = await ext.launch({ headless: false });
    const context = await browser.newContext();
    await use(context);
    await browser.close();
  },

  seedSettings: async ({ extensionContext: context }, use) => {
    const seed = async (settings: any) => {
      const page = await context.newPage();
      await page.goto('http://localhost:4173/');

      // Wait for dev-seed to register the ONNX model in settings
      await page.waitForFunction(
        (modelId: string) => {
          return new Promise<boolean>((resolve) => {
            const handler = (event: MessageEvent) => {
              if (event.data?.type === '__test_settings_result__') {
                window.removeEventListener('message', handler);
                const s = event.data.settings;
                resolve(s?.models?.some((m: any) => m.id === modelId) ?? false);
              }
            };
            window.addEventListener('message', handler);
            window.postMessage({ type: '__test_get_settings__' }, '*');
          });
        },
        DEV_ONNX_MODEL_ID,
        { timeout: 30_000, polling: 1000 },
      );

      // Override settings via the test bridge
      await page.evaluate((s) => {
        return new Promise<void>((resolve) => {
          const handler = (event: MessageEvent) => {
            if (event.data?.type === '__test_settings_updated__') {
              window.removeEventListener('message', handler);
              resolve();
            }
          };
          window.addEventListener('message', handler);
          window.postMessage({ type: '__test_update_settings__', settings: s }, '*');
        });
      }, settings);

      await page.close();
    };
    await use(seed);
  },
});

export { expect };
