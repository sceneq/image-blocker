import { test, expect } from './fixtures';
import type { Settings, FilterRule, StoredModel } from '../src/shared/types';

const MODEL: StoredModel = {
  id: 'dev-onnx-komondor',
  name: 'Dev Sample ONNX (Komondor)',
  labels: { '0': 'AI generated', '1': 'questionable', '2': 'コモンドール' },
  backend: 'onnx',
};

const BASE = 'http://localhost:4173';

// All-negative weights guarantee score = -w (since softmax sums to 1).
// score = -(w * Σprob) = -w when all weights are the same.
const BLOCK_WEIGHTS = { 'AI generated': -0.5, 'questionable': -0.5, 'コモンドール': -0.5 };
const OPACITY_WEIGHTS = { 'AI generated': -0.3, 'questionable': -0.3, 'コモンドール': -0.3 };

function makeSettings(rule: FilterRule, opts?: { globalEnabled?: boolean }): Settings {
  return {
    globalEnabled: opts?.globalEnabled ?? true,
    models: [MODEL],
    rules: [rule],
  };
}

// Wait until all large images (>= 50px) have a terminal status attribute
async function waitForProcessing(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const imgs = document.querySelectorAll('img');
    for (const img of imgs) {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w < 50 || h < 50) continue;
      const status = img.getAttribute('data-image-blocker-status');
      if (!status || !['done', 'skipped', 'error'].includes(status)) return false;
    }
    return true;
  }, { timeout: 50_000 });
}

test('classification applies opacity', async ({ extensionContext: context, seedSettings }) => {
  const rule: FilterRule = {
    id: 'rule-opacity',
    name: 'Opacity test',
    sitePattern: '.*localhost.*',
    modelId: MODEL.id,
    weights: OPACITY_WEIGHTS,
    pendingStyle: 'pulse',
    blockEnabled: false,
    blockThreshold: 0.5,
    enabled: true,
    priority: 0,
  };

  await seedSettings(makeSettings(rule));

  const page = await context.newPage();
  await page.goto(`${BASE}/test-images.html`);
  await waitForProcessing(page);

  const statuses = await page.$$eval(
    'img[data-image-blocker-status]',
    imgs => imgs.map(img => ({
      alt: img.getAttribute('alt'),
      status: img.getAttribute('data-image-blocker-status'),
      opacity: (img as HTMLElement).style.opacity,
    })),
  );

  const doneImages = statuses.filter(s => s.status === 'done');
  expect(doneImages.length).toBeGreaterThanOrEqual(1);

  for (const img of doneImages) {
    const op = parseFloat(img.opacity);
    expect(op).toBeGreaterThanOrEqual(0);
    expect(op).toBeLessThan(1);
  }

  await page.close();
});

test('block mode wraps images', async ({ extensionContext: context, seedSettings }) => {
  const rule: FilterRule = {
    id: 'rule-block',
    name: 'Block test',
    sitePattern: '.*localhost.*',
    modelId: MODEL.id,
    weights: BLOCK_WEIGHTS,
    pendingStyle: 'pulse',
    blockEnabled: true,
    blockThreshold: 0.1,
    enabled: true,
    priority: 0,
  };

  await seedSettings(makeSettings(rule));

  const page = await context.newPage();
  await page.goto(`${BASE}/test-images.html`);
  await waitForProcessing(page);

  const wrappers = page.locator('.clf-block-wrapper');
  const overlays = page.locator('.clf-block-overlay');

  const wrapperCount = await wrappers.count();
  const overlayCount = await overlays.count();
  expect(wrapperCount).toBeGreaterThanOrEqual(1);
  expect(overlayCount).toBe(wrapperCount);

  if (overlayCount > 0) {
    const text = await overlays.first().textContent();
    expect(text).toBe('クリックで表示');
  }

  await page.close();
});

test('click overlay reveals image', async ({ extensionContext: context, seedSettings }) => {
  const rule: FilterRule = {
    id: 'rule-click',
    name: 'Click test',
    sitePattern: '.*localhost.*',
    modelId: MODEL.id,
    weights: BLOCK_WEIGHTS,
    pendingStyle: 'pulse',
    blockEnabled: true,
    blockThreshold: 0.1,
    enabled: true,
    priority: 0,
  };

  await seedSettings(makeSettings(rule));

  const page = await context.newPage();
  await page.goto(`${BASE}/test-images.html`);
  await waitForProcessing(page);

  const wrapper = page.locator('.clf-block-wrapper').first();
  await expect(wrapper).toBeVisible();

  const overlay = wrapper.locator('.clf-block-overlay');
  const img = wrapper.locator('img');

  await overlay.click();

  // Overlay within this wrapper should be removed
  await expect(overlay).toHaveCount(0);

  // Image opacity should be restored to 1
  const opacity = await img.evaluate(el => (el as HTMLElement).style.opacity);
  expect(opacity).toBe('1');

  await page.close();
});

test('globalEnabled=false skips all', async ({ extensionContext: context, seedSettings }) => {
  const rule: FilterRule = {
    id: 'rule-disabled',
    name: 'Disabled test',
    sitePattern: '.*localhost.*',
    modelId: MODEL.id,
    weights: BLOCK_WEIGHTS,
    pendingStyle: 'pulse',
    blockEnabled: false,
    blockThreshold: 0.5,
    enabled: true,
    priority: 0,
  };

  await seedSettings(makeSettings(rule, { globalEnabled: false }));

  const page = await context.newPage();
  await page.goto(`${BASE}/test-images.html`);

  // Content script should exit early when globalEnabled=false
  await page.waitForTimeout(3000);

  const statusCount = await page.$$eval(
    'img[data-image-blocker-status]',
    imgs => imgs.length,
  );
  expect(statusCount).toBe(0);

  await page.close();
});

test('snapshot: opacity values', async ({ extensionContext: context, seedSettings }) => {
  const rule: FilterRule = {
    id: 'rule-snapshot',
    name: 'Snapshot test',
    sitePattern: '.*localhost.*',
    modelId: MODEL.id,
    weights: OPACITY_WEIGHTS,
    pendingStyle: 'pulse',
    blockEnabled: false,
    blockThreshold: 0.5,
    enabled: true,
    priority: 0,
  };

  await seedSettings(makeSettings(rule));

  const page = await context.newPage();
  await page.goto(`${BASE}/test-images.html`);
  await waitForProcessing(page);

  const snapshot = await page.$$eval('img', imgs =>
    imgs.map((img, index) => ({
      index,
      alt: img.getAttribute('alt'),
      status: img.getAttribute('data-image-blocker-status'),
      opacity: (img as HTMLElement).style.opacity || null,
    })),
  );

  expect(JSON.stringify(snapshot, null, 2)).toMatchSnapshot('image-filter-opacities.json');

  await page.close();
});
