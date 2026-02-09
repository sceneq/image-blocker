import '@/lib/browser-shim';
import { ImageObserver } from '@/lib/image-observer';
import { matchRule } from '@/lib/rule-matcher';
import { calculateScore, applyFilter, injectBlockStyles, showImage } from '@/lib/image-filter';
import { getSettings } from '@/shared/storage';
import { IMAGE_STATUS_ATTR } from '@/shared/constants';
import type { ClassifyRequest, ClassifyResponse, FilterRule, Settings } from '@/shared/types';

(async () => {
  // DEV-only test bridge: allows E2E tests to read/write browser.storage.local
  // via window.postMessage without navigating to moz-extension:// pages.
  if (import.meta.env.DEV) {
    window.addEventListener('message', async (event) => {
      if (event.source !== window) return;
      if (event.data?.type === '__test_get_settings__') {
        const result = await browser.storage.local.get('image-blocker-settings');
        window.postMessage({
          type: '__test_settings_result__',
          settings: result['image-blocker-settings'] ?? null,
        }, '*');
      }
      if (event.data?.type === '__test_update_settings__') {
        await browser.storage.local.set({ 'image-blocker-settings': event.data.settings });
        window.postMessage({ type: '__test_settings_updated__' }, '*');
      }
    });
  }

  injectBlockStyles();

  const settings = await getSettings();
  if (!settings.globalEnabled) return;

  const rule = matchRule(window.location.href, settings.rules);
  if (!rule) return;

  let watcher = new ImageObserver((img) => {
    classifyAndFilter(img, rule, settings);
  }, rule.pendingStyle);
  watcher.start();

  // Watch for setting changes and restart
  browser.storage.onChanged.addListener(async () => {
    watcher.stop();
    const newSettings = await getSettings();
    if (!newSettings.globalEnabled) return;

    const newRule = matchRule(window.location.href, newSettings.rules);
    if (!newRule) return;

    watcher = new ImageObserver((img) => {
      classifyAndFilter(img, newRule, newSettings);
    }, newRule.pendingStyle);
    watcher.start();
  });
})();

function loadImage(url: string, size: number): Promise<HTMLImageElement> {
  const image = new Image(size, size);
  return new Promise((resolve, reject) => {
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = (err) => reject(err);
    image.src = url;
  });
}

function extractPixels(
  img: HTMLImageElement,
  size: number,
): { pixels: ArrayBuffer; width: number; height: number } {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  return { pixels: imageData.data.buffer.slice(0) as ArrayBuffer, width: size, height: size };
}

async function classifyAndFilter(
  img: HTMLImageElement,
  rule: FilterRule,
  settings: Settings,
): Promise<void> {
  try {
    const src = img.src;
    if (!src) {
      showImage(img);
      img.setAttribute(IMAGE_STATUS_ATTR, 'skipped');
      return;
    }

    const model = settings.models.find((m) => m.id === rule.modelId);
    const imageSize = model?.imageSize ?? 224;

    let loaded: HTMLImageElement;
    try {
      loaded = await loadImage(src, imageSize);
    } catch {
      // Skip if loading fails due to CORS or similar issues
      showImage(img);
      img.setAttribute(IMAGE_STATUS_ATTR, 'skipped');
      return;
    }

    const { pixels, width, height } = extractPixels(loaded, imageSize);

    const request: ClassifyRequest = {
      type: 'classify',
      imageUrl: src,
      ruleId: rule.id,
      pixels,
      width,
      height,
    };

    const response: ClassifyResponse = await browser.runtime.sendMessage(request);

    if (response.type === 'classify-error') {
      console.warn('[image-blocker] classify error:', response.error);
      showImage(img);
      img.setAttribute(IMAGE_STATUS_ATTR, 'error');
      return;
    }

    const score = calculateScore(response.probabilities, rule.weights);

    applyFilter(img, score, rule.blockThreshold, rule.blockEnabled ?? true);
    img.setAttribute(IMAGE_STATUS_ATTR, 'done');
  } catch (e) {
    console.warn('[image-blocker] error:', e);
    showImage(img);
    img.setAttribute(IMAGE_STATUS_ATTR, 'error');
  }
}
