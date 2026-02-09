// 開発用
import { parseTfjsZip } from '@/lib/parse-tfjs-zip';
import { saveTfjsModel, saveModelBinary } from '@/lib/model-store';
import { getSettings, saveSettings } from '@/shared/storage';
import { parseOnnxExternalData } from '@/lib/onnx-proto';
import type { StoredModel, FilterRule } from '@/shared/types';

const DEV_MODEL_ID = 'dev-sample-komondor';
const DEV_RULE_ID = 'dev-rule-komondor';
const DEV_ONNX_MODEL_ID = 'dev-onnx-komondor';
const DEV_ONNX_RULE_ID = 'dev-rule-onnx-komondor';

export async function devSeed(): Promise<void> {
  const settings = await getSettings();
  let changed = false;

  // Seed TF.js model
  if (!settings.models.some((m) => m.id === DEV_MODEL_ID)) {
    console.log('[image-blocker] dev-seed: seeding TF.js sample model...');

    // Fetch the zip file
    const zipUrl: string = browser.runtime.getURL('dev-fixtures/sample-model-komondor.zip');
    const res = await fetch(zipUrl);
    if (!res.ok) throw new Error(`Failed to fetch dev fixture: ${res.status}`);
    const buffer = await res.arrayBuffer();

    // Parse the zip
    const { modelJson, weightsBin, metadata } = parseTfjsZip(buffer);

    // Save to IndexedDB
    await saveTfjsModel(DEV_MODEL_ID, modelJson, weightsBin);

    // Build label map
    const labels: Record<string, string> = {};
    if (metadata.labels) {
      for (let i = 0; i < metadata.labels.length; i++) {
        labels[String(i)] = metadata.labels[i];
      }
    }

    // Add model to Settings
    const model: StoredModel = {
      id: DEV_MODEL_ID,
      name: metadata.modelName ?? 'Dev Sample (Komondor)',
      labels,
      backend: 'tfjs',
      imageSize: metadata.imageSize ?? 224,
    };

    // Add rule: match all sites, set Class 2 to high weight
    const rule: FilterRule = {
      id: DEV_RULE_ID,
      name: 'Dev Sample',
      sitePattern: '.*',
      modelId: DEV_MODEL_ID,
      weights: { 'Class 1': 0.0, 'Class 2': 0.9 },
      pendingStyle: 'pulse',
      enabled: false,
      priority: 99,
      blockEnabled: false,
      blockThreshold: 0.0,
    };

    settings.models.push(model);
    if (!settings.rules.some((r) => r.id === DEV_RULE_ID)) {
      settings.rules.push(rule);
    }
    settings.globalEnabled = true;
    changed = true;

    console.log('[image-blocker] dev-seed: TF.js model seeded');
  } else {
    console.log('[image-blocker] dev-seed: TF.js model already exists, skipping');
  }

  // Seed ONNX model
  if (!settings.models.some((m) => m.id === DEV_ONNX_MODEL_ID)) {
    console.log('[image-blocker] dev-seed: seeding ONNX sample model...');

    const baseUrl: string = browser.runtime.getURL('dev-fixtures/komondor-onnx/');
    const [onnxRes, dataRes, labelsRes] = await Promise.all([
      fetch(baseUrl + 'model.fp32.onnx'),
      fetch(baseUrl + 'model.fp32.onnx.data'),
      fetch(baseUrl + 'labels.json'),
    ]);
    const [onnxBuffer, dataBuffer, labelsJson] = await Promise.all([
      onnxRes.arrayBuffer(),
      dataRes.arrayBuffer(),
      labelsRes.json() as Promise<Record<string, string>>,
    ]);

    const extPath = parseOnnxExternalData(onnxBuffer).externalDataPath ?? 'model.fp32.onnx.data';
    await saveModelBinary(DEV_ONNX_MODEL_ID, onnxBuffer, dataBuffer, extPath);

    const model: StoredModel = {
      id: DEV_ONNX_MODEL_ID,
      name: 'Dev Sample ONNX (Komondor)',
      labels: labelsJson,
      backend: 'onnx',
    };
    const rule: FilterRule = {
      id: DEV_ONNX_RULE_ID,
      name: 'Dev Sample ONNX',
      sitePattern: '.*',
      modelId: DEV_ONNX_MODEL_ID,
      weights: { 'questionable': 0.0, 'AI generated': -1.0, 'コモンドール': 1.0 },
      pendingStyle: 'pulse',
      enabled: true,
      priority: 0,
      blockEnabled: true,
      blockThreshold: 0.10,
    };

    settings.models.push(model);
    if (!settings.rules.some((r) => r.id === DEV_ONNX_RULE_ID)) {
      settings.rules.push(rule);
    }
    changed = true;

    console.log('[image-blocker] dev-seed: ONNX model seeded');
  } else {
    console.log('[image-blocker] dev-seed: ONNX model already exists, skipping');
  }

  if (changed) {
    await saveSettings(settings);
    console.log('[image-blocker] dev-seed: settings saved');
  }
}
