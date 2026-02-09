import '@/lib/browser-shim';
import { initOnnxRuntime, classify, evictSession } from '@/lib/classifier';
import { initTfjsRuntime, classifyTfjs, evictTfjsModel } from '@/lib/tfjs-classifier';
import { matchAllRules } from '@/lib/rule-matcher';
import { LRUCache } from '@/lib/lru-cache';
import { getSettings } from '@/shared/storage';
import { CACHE_SIZE } from '@/shared/constants';
import type {
  ClassifyRequest,
  ClassifyResponse,
  GetActiveRuleRequest,
  GetActiveRuleResponse,
  Message,
  Settings,
} from '@/shared/types';

/** URL → 分類確率の LRU キャッシュ */
const classifyCache = new LRUCache<string, Record<string, number>>(CACHE_SIZE);

/** 設定キャッシュ */
let settingsCache: Settings | null = null;

async function getCachedSettings(): Promise<Settings> {
  if (!settingsCache) {
    settingsCache = await getSettings();
  }
  return settingsCache;
}

/** 前回の設定からモデルIDセットを保持 (削除検出用) */
let previousModelIds = new Set<string>();
let previousModelsBackendMap = new Map<string, string>();

// Initialize ONNX Runtime
initOnnxRuntime();

// Initialize TF.js Runtime
initTfjsRuntime().catch((err) =>
  console.error('[image-blocker] TF.js init failed:', err)
);

// Record model ID from initial settings
getCachedSettings().then((settings) => {
  for (const m of settings.models) {
    previousModelIds.add(m.id);
    previousModelsBackendMap.set(m.id, m.backend ?? 'onnx');
  }
});

// Auto-register sample models in dev mode only
if (import.meta.env.DEV) {
  import('@/lib/dev-seed').then(({ devSeed }) =>
    devSeed().catch((err) =>
      console.error('[image-blocker] dev-seed failed:', err)
    )
  );
}

// Message handler
browser.runtime.onMessage.addListener(
  (message: Message, sender: browser.Runtime.MessageSender): Promise<ClassifyResponse | GetActiveRuleResponse | undefined> | undefined => {
    if (message.type === 'classify') {
      return handleClassify(message, sender);
    }
    if (message.type === 'settings-changed') {
      handleSettingsChanged();
      return undefined;
    }
    if (message.type === 'get-active-rule') {
      return handleGetActiveRule(message);
    }
    return undefined;
  },
);

// Watch for storage changes
browser.storage.onChanged.addListener(() => {
  settingsCache = null;
});

async function handleClassify(
  req: ClassifyRequest,
  _sender: browser.Runtime.MessageSender,
): Promise<ClassifyResponse> {
  try {
    const cacheKey = `${req.ruleId}:${req.imageUrl}`;
    const cached = classifyCache.get(cacheKey);
    if (cached) {
      return { type: 'classify-result', probabilities: cached };
    }

    const settings = await getCachedSettings();
    const rule = settings.rules.find((r) => r.id === req.ruleId);
    if (!rule) {
      return { type: 'classify-error', error: 'Rule not found' };
    }

    const model = settings.models.find((m) => m.id === rule.modelId);
    if (!model) {
      return { type: 'classify-error', error: 'Model not found' };
    }

    let probabilities: Record<string, number>;
    if (model.backend === 'tfjs') {
      probabilities = await classifyTfjs(req.pixels, req.width, req.height, model);
    } else {
      probabilities = await classify(req.pixels, req.width, req.height, model);
    }
    classifyCache.set(cacheKey, probabilities);

    return { type: 'classify-result', probabilities };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('[image-blocker] classify error:', errorMsg);
    return { type: 'classify-error', error: errorMsg };
  }
}

async function handleSettingsChanged(): Promise<void> {
  settingsCache = null;
  classifyCache.clear();
  const settings = await getCachedSettings();

  const currentIds = new Set<string>();
  const currentBackendMap = new Map<string, string>();
  for (const m of settings.models) {
    currentIds.add(m.id);
    currentBackendMap.set(m.id, m.backend ?? 'onnx');
  }

  // Clean up cache for deleted models
  for (const id of previousModelIds) {
    if (!currentIds.has(id)) {
      const backend = previousModelsBackendMap.get(id) ?? 'onnx';
      if (backend === 'tfjs') {
        evictTfjsModel(id);
      } else {
        evictSession(id);
      }
    }
  }

  previousModelIds = currentIds;
  previousModelsBackendMap = currentBackendMap;
}

async function handleGetActiveRule(
  req: GetActiveRuleRequest,
): Promise<GetActiveRuleResponse> {
  const settings = await getCachedSettings();
  if (!settings.globalEnabled) {
    return { type: 'active-rule-result', rule: null, otherMatched: [] };
  }
  const matches = matchAllRules(req.url, settings.rules);
  return {
    type: 'active-rule-result',
    rule: matches[0] ?? null,
    otherMatched: matches.slice(1),
  };
}
