import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import { loadTfjsModel } from './model-store';
import { softmax } from './softmax';
import type { StoredModel } from '@/shared/types';

/** モデルIDごとのキャッシュ */
const modelCache = new Map<string, tf.LayersModel | tf.GraphModel>();

let initPromise: Promise<void> | null = null;

export function initTfjsRuntime(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const backends = ['webgpu', 'webgl', 'wasm', 'cpu'] as const;

    for (const backend of backends) {
      try {
        const ok = await tf.setBackend(backend);
        if (ok) {
          await tf.ready();
          console.log(`[image-blocker] tf.getBackend()=${tf.getBackend()}`);
          break;
        }
      } catch {
        // try next
      }
    }
  })();

  return initPromise;
}

async function getModel(modelId: string): Promise<tf.LayersModel | tf.GraphModel> {
  const cached = modelCache.get(modelId);
  if (cached) return cached;

  const data = await loadTfjsModel(modelId);
  if (!data) throw new Error(`TF.js model not found: ${modelId}`);

  const modelConfig = JSON.parse(data.modelJson);

  // Check the format field in model.json to distinguish LayersModel from GraphModel
  const isGraphModel =
    modelConfig.format === 'graph-model' ||
    modelConfig.modelTopology?.node != null;

  // Extract weightSpecs from weightsManifest
  const weightSpecs: tf.io.WeightsManifestEntry[] =
    modelConfig.weightsManifest?.[0]?.weights ?? [];

  // Build ModelArtifacts using a custom IOHandler
  const handler: tf.io.IOHandler = {
    async load(): Promise<tf.io.ModelArtifacts> {
      const weightData = data.weightsBin;

      if (isGraphModel) {
        return {
          format: 'graph-model',
          modelTopology: modelConfig.modelTopology,
          weightData,
          weightSpecs,
        };
      }

      return {
        modelTopology: modelConfig.modelTopology,
        weightData,
        weightSpecs,
      };
    },
  };

  const model = isGraphModel
    ? await tf.loadGraphModel(handler)
    : await tf.loadLayersModel(handler);

  modelCache.set(modelId, model);
  return model;
}

export function evictTfjsModel(modelId: string): void {
  const model = modelCache.get(modelId);
  if (model) {
    model.dispose();
    modelCache.delete(modelId);
  }
}

/**
 * TF.js モデルでピクセルデータを分類し、ラベルごとの確率を返す
 */
export async function classifyTfjs(
  pixels: ArrayBuffer,
  width: number,
  height: number,
  model: StoredModel,
): Promise<Record<string, number>> {
  const tfModel = await getModel(model.id);

  const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);

  // Run inference inside tf.tidy
  const outputData = tf.tidy(() => {
    const pixelTensor = tf.browser.fromPixels(imageData, 3);
    const normalized = pixelTensor.toFloat().div(255);
    const batched = normalized.expandDims(0); // shape: [1, H, W, 3]
    const prediction = tfModel.predict(batched) as tf.Tensor;
    return prediction;
  });

  let probabilities: Float32Array;
  try {
    const rawData = await outputData.data() as Float32Array;

    // Apply softmax if the output does not sum to roughly 1.0
    let sum = 0;
    for (let i = 0; i < rawData.length; i++) {
      sum += rawData[i];
    }
    probabilities = Math.abs(sum - 1.0) > 0.01
      ? softmax(rawData)
      : rawData;
  } finally {
    outputData.dispose();
  }

  // Label mapping
  const result: Record<string, number> = {};
  const labelKeys = Object.keys(model.labels).sort(
    (a, b) => Number(a) - Number(b),
  );
  for (let i = 0; i < labelKeys.length; i++) {
    const labelName = model.labels[labelKeys[i]];
    result[labelName] = probabilities[i] ?? 0;
  }

  return result;
}
