import * as ort from 'onnxruntime-web/wasm';
import { loadOnnxModelRecord } from './model-store';
import { softmax } from './softmax';
import type { StoredModel } from '@/shared/types';

/** モデルIDごとの InferenceSession キャッシュ */
const sessionCache = new Map<string, ort.InferenceSession>();

export function initOnnxRuntime(): void {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = browser.runtime.getURL('/wasm/');
}

/** モデルのセッション */
async function getSession(modelId: string): Promise<ort.InferenceSession> {
  const cached = sessionCache.get(modelId);
  if (cached) return cached;

  const record = await loadOnnxModelRecord(modelId);
  if (!record) throw new Error(`Model binary not found: ${modelId}`);

  const opts: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'] };
  if (record.externalData && record.externalDataPath) {
    opts.externalData = [{
      data: new Uint8Array(record.externalData),
      path: record.externalDataPath,
    }];
  }
  const session = await ort.InferenceSession.create(record.data, opts);
  sessionCache.set(modelId, session);
  return session;
}

/** セッションキャッシュからモデルを削除 */
export function evictSession(modelId: string): void {
  const session = sessionCache.get(modelId);
  if (session) {
    session.release();
    sessionCache.delete(modelId);
  }
}

/**
 * ピクセルデータを分類し、ラベルごとの確率を返す
 */
export async function classify(
  pixels: ArrayBuffer,
  width: number,
  height: number,
  model: StoredModel,
): Promise<Record<string, number>> {
  const session = await getSession(model.id);

  // Get input shape, e.g. [1, 3, 224, 224]
  // inputMetadata is an array indexed by number. String keys return undefined.
  const inputName = session.inputNames[0];
  const inputMeta = session.inputMetadata[0];
  if (!inputMeta.isTensor) throw new Error(`Expected tensor input for model ${model.id}`);
  // shape is ReadonlyArray of number or string. Dynamic batch dimensions may be strings.
  const inputShape = Array.from(inputMeta.shape).map((d) => (typeof d === 'number' ? d : 1));
  // shape is either [batch, channels, height, width] or [batch, height, width, channels]
  const isChannelFirst = inputShape[1] === 3 || inputShape[1] === 1;
  const channels = isChannelFirst ? inputShape[1] : inputShape[3];

  const rgba = new Uint8ClampedArray(pixels);

  // Convert to Float32 tensor and normalize from 0-255 to 0-1
  const tensorSize = 1 * channels * height * width;
  const float32Data = new Float32Array(tensorSize);

  if (isChannelFirst) {
    // [1, C, H, W]
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIdx = (y * width + x) * 4;
        for (let c = 0; c < channels; c++) {
          float32Data[c * height * width + y * width + x] = rgba[pixelIdx + c] / 255.0;
        }
      }
    }
  } else {
    // [1, H, W, C]
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIdx = (y * width + x) * 4;
        for (let c = 0; c < channels; c++) {
          float32Data[y * width * channels + x * channels + c] = rgba[pixelIdx + c] / 255.0;
        }
      }
    }
  }

  const tensor = new ort.Tensor('float32', float32Data, inputShape as number[]);
  const feeds: Record<string, ort.Tensor> = { [inputName]: tensor };

  // Run inference; read output data, then release all WASM-backed tensors
  const results = await session.run(feeds);
  const outputName = session.outputNames[0];
  // Compute softmax before disposing to avoid use-after-free on the typed array view
  const probabilities = softmax(results[outputName].data as Float32Array);
  tensor.dispose();
  for (const t of Object.values(results)) t.dispose();

  // Map label names to probabilities
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
