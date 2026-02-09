import type { PendingStyle, Settings, StoredModel } from './types';
import { STORAGE_KEY } from './constants';

const defaultSettings: Settings = {
  globalEnabled: true,
  models: [],
  rules: [],
};

/** 設定を取得する (マイグレーション含む) */
export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const raw = (result[STORAGE_KEY] ?? { ...defaultSettings }) as any;

  // Legacy: global pendingStyle, migrate to per-rule style
  const legacyPendingStyle: PendingStyle = raw.pendingStyle ?? 'pulse';
  delete raw.pendingStyle;

  for (const rule of raw.rules ?? []) {
    if (!rule.pendingStyle) rule.pendingStyle = legacyPendingStyle;
    if (!rule.name) rule.name = '';
    if (rule.priority === undefined) rule.priority = 0;
    if (rule.blockThreshold === undefined) rule.blockThreshold = 0.5;
  }
  for (const model of raw.models ?? []) {
    if (!model.backend) (model as StoredModel).backend = 'onnx';
  }
  return raw as Settings;
}

/** 設定を保存する */
export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}
