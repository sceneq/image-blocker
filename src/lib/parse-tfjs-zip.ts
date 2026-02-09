import { unzipSync } from 'fflate';

export interface TfjsZipData {
  modelJson: string;
  weightsBin: ArrayBuffer;
  metadata: { modelName?: string; labels?: string[]; imageSize?: number };
}

export function parseTfjsZip(buffer: ArrayBuffer): TfjsZipData {
  const files = unzipSync(new Uint8Array(buffer));

  let modelJson: string | null = null;
  let weightsBin: ArrayBuffer | null = null;
  let metadata: { modelName?: string; labels?: string[]; imageSize?: number } = {};

  for (const [path, data] of Object.entries(files)) {
    const name = path.split('/').pop()!;
    if (name === 'model.json') {
      modelJson = new TextDecoder().decode(data);
    } else if (name === 'weights.bin') {
      weightsBin = (data.buffer as ArrayBuffer).slice(data.byteOffset, data.byteOffset + data.byteLength);
    } else if (name === 'metadata.json') {
      const parsed = JSON.parse(new TextDecoder().decode(data));
      metadata = {
        modelName: parsed.modelName ?? parsed.name,
        labels: parsed.labels,
        imageSize: parsed.imageSize,
      };
    }
  }

  if (!modelJson) throw new Error('zip 内に model.json が見つかりません');
  if (!weightsBin) throw new Error('zip 内に weights.bin が見つかりません');

  return { modelJson, weightsBin, metadata };
}
