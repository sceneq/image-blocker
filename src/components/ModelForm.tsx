import { useState, useRef, useEffect } from 'react';
import type { StoredModel, ModelBackend } from '@/shared/types';
import { saveModelBinary, saveTfjsModel } from '@/lib/model-store';
import { parseTfjsZip, type TfjsZipData } from '@/lib/parse-tfjs-zip';
import { parseOnnxExternalData } from '@/lib/onnx-proto';

interface Props {
  editingModel: StoredModel | null;
  models: StoredModel[];
  onModelsChange: (models: StoredModel[]) => void;
  onDone: () => void;
}

export default function ModelForm({ editingModel, models, onModelsChange, onDone }: Props) {
  const [name, setName] = useState('');
  const [labels, setLabels] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detectedBackend, setDetectedBackend] = useState<ModelBackend>('onnx');
  const [showFileInput, setShowFileInput] = useState(false);

  // For ONNX
  const [onnxFile, setOnnxFile] = useState<File | null>(null);
  const [needsExternalData, setNeedsExternalData] = useState(false);
  const [onnxDataFile, setOnnxDataFile] = useState<File | null>(null);
  const [extractedExtPath, setExtractedExtPath] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const onnxDataInputRef = useRef<HTMLInputElement>(null);

  // For TF.js
  const [tfjsData, setTfjsData] = useState<TfjsZipData | null>(null);
  const [tfjsImageSize, setTfjsImageSize] = useState<number>(224);

  const modelInputRef = useRef<HTMLInputElement>(null);

  const isEditing = editingModel !== null;

  // Reset or pre-fill state when editingModel changes
  useEffect(() => {
    if (editingModel) {
      setName(editingModel.name);
      setLabels({ ...editingModel.labels });
      setDetectedBackend(editingModel.backend);
      setTfjsImageSize(editingModel.imageSize ?? 224);
      setShowFileInput(false);
    } else {
      setName('');
      setLabels(null);
      setDetectedBackend('onnx');
      setTfjsImageSize(224);
      setShowFileInput(false);
    }
    setOnnxFile(null);
    setTfjsData(null);
    setNeedsExternalData(false);
    setOnnxDataFile(null);
    setExtractedExtPath(null);
    setError('');
    if (labelInputRef.current) labelInputRef.current.value = '';
    if (modelInputRef.current) modelInputRef.current.value = '';
    if (onnxDataInputRef.current) onnxDataInputRef.current.value = '';
  }, [editingModel]);

  const handleModelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    if (file.name.endsWith('.zip')) {
      setDetectedBackend('tfjs');
      setOnnxFile(null);

      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseTfjsZip(buffer);
        setTfjsData(parsed);

        if (parsed.metadata.modelName) {
          setName(parsed.metadata.modelName);
        }
        if (parsed.metadata.imageSize) {
          setTfjsImageSize(parsed.metadata.imageSize);
        }
        if (parsed.metadata.labels) {
          const labelMap: Record<string, string> = {};
          for (let i = 0; i < parsed.metadata.labels.length; i++) {
            labelMap[String(i)] = parsed.metadata.labels[i];
          }
          setLabels(labelMap);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'zip の解析に失敗しました');
        setTfjsData(null);
      }
    } else if (file.name.endsWith('.onnx')) {
      setDetectedBackend('onnx');
      setOnnxFile(file);
      setTfjsData(null);
      if (!isEditing) {
        setLabels(null);
        setName(file.name.replace(/\.onnx$/, ''));
      }

      const buffer = await file.arrayBuffer();
      const { hasExternalData, externalDataPath } = parseOnnxExternalData(buffer);
      setNeedsExternalData(hasExternalData);
      setExtractedExtPath(externalDataPath);
      if (!hasExternalData) setOnnxDataFile(null);
    } else {
      setError('.onnx または .zip ファイルを選択してください');
    }
  };

  const handleLabelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (typeof parsed !== 'object' || parsed === null) {
          setError('label.json は { "0": "ラベル名", ... } の形式が必要です');
          return;
        }
        setLabels(parsed);
      } catch {
        setError('label.json のパースに失敗しました');
      }
    };
    reader.readAsText(file);
  };

  const handleLabelChange = (key: string, value: string) => {
    if (!labels) return;
    setLabels({ ...labels, [key]: value });
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('モデル名を入力してください'); return; }
    if (!labels) { setError('ラベルが設定されていません'); return; }

    if (isEditing) {
      setLoading(true);
      setError('');

      try {
        const id = editingModel.id;
        const hasNewFile = onnxFile || tfjsData;

        if (hasNewFile) {
          if (detectedBackend === 'tfjs' && tfjsData) {
            await saveTfjsModel(id, tfjsData.modelJson, tfjsData.weightsBin);
          } else if (onnxFile) {
            const arrayBuffer = await onnxFile.arrayBuffer();
            const extBuffer = onnxDataFile ? await onnxDataFile.arrayBuffer() : undefined;
            const extPath = extractedExtPath ?? undefined;
            await saveModelBinary(id, arrayBuffer, extBuffer, extPath);
          }
        }

        const updatedModel: StoredModel = {
          id,
          name: name.trim(),
          labels,
          backend: hasNewFile ? detectedBackend : editingModel.backend,
          ...(detectedBackend === 'tfjs' || editingModel.backend === 'tfjs'
            ? { imageSize: tfjsImageSize }
            : {}),
        };
        onModelsChange(models.map((m) => m.id === id ? updatedModel : m));
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : '更新に失敗しました');
      } finally {
        setLoading(false);
      }
    } else {
      if (detectedBackend === 'onnx' && !onnxFile) {
        setError('.onnx ファイルを選択してください');
        return;
      }
      if (detectedBackend === 'tfjs' && !tfjsData) {
        setError('.zip ファイルを選択してください');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const id = crypto.randomUUID();

        if (detectedBackend === 'tfjs' && tfjsData) {
          await saveTfjsModel(id, tfjsData.modelJson, tfjsData.weightsBin);
          const newModel: StoredModel = {
            id,
            name: name.trim(),
            labels,
            backend: 'tfjs',
            imageSize: tfjsImageSize,
          };
          onModelsChange([...models, newModel]);
        } else if (onnxFile) {
          const arrayBuffer = await onnxFile.arrayBuffer();
          const extBuffer = onnxDataFile ? await onnxDataFile.arrayBuffer() : undefined;
          const extPath = extractedExtPath ?? undefined;
          await saveModelBinary(id, arrayBuffer, extBuffer, extPath);
          const newModel: StoredModel = {
            id,
            name: name.trim(),
            labels,
            backend: 'onnx',
          };
          onModelsChange([...models, newModel]);
        }

        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : '登録に失敗しました');
      } finally {
        setLoading(false);
      }
    }
  };

  const showForm = isEditing || onnxFile || tfjsData;

  return (
    <model-form>
      <h3>
        {isEditing ? 'モデルを編集' : 'モデルを追加'}
      </h3>

      {!isEditing && (
        <hint-text style={{ marginBottom: 12 }}>
          <a href="https://teachablemachine.withgoogle.com/train/image"
             target="_blank"
             rel="noopener noreferrer">
            Teachable Machine
          </a>でモデルを作成できます。
        </hint-text>
      )}

      {isEditing && !showFileInput ? (
        <form-row>
          <label>モデルファイル</label>
          <hint-text>
            現在の形式: {editingModel.backend === 'tfjs' ? 'TensorFlow.js' : 'ONNX'}
            <button
              style={{ marginLeft: 8, fontSize: 12, padding: '2px 8px' }}
              onClick={() => setShowFileInput(true)}
            >
              ファイルを変更
            </button>
          </hint-text>
        </form-row>
      ) : (
        <form-row>
          <label>モデルファイル (.onnx / .zip)</label>
          <input
            type="file"
            accept=".onnx,.zip"
            ref={modelInputRef}
            onChange={handleModelFile}
          />
          {detectedBackend === 'tfjs' && tfjsData && (
            <hint-text style={{ marginTop: 4 }}>
              検出形式: TensorFlow.js
            </hint-text>
          )}
        </form-row>
      )}

      {showForm && (
        <>
          <form-row>
            <label>モデル名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: NSFW Classifier"
            />
          </form-row>

          {detectedBackend === 'onnx' && (showFileInput || !isEditing) && onnxFile && (
            <>
              {needsExternalData && (
                <form-row>
                  <label>外部データファイル (.onnx.data)</label>
                  <input
                    type="file"
                    accept=".data"
                    ref={onnxDataInputRef}
                    onChange={(e) => setOnnxDataFile(e.target.files?.[0] ?? null)}
                  />
                  {!onnxDataFile && (
                    <warning-text>
                      このモデルには外部データファイルが必要です
                    </warning-text>
                  )}
                </form-row>
              )}
            </>
          )}

          {labels && (
            <form-row>
              <label>ラベル</label>
              {isEditing ? (
                Object.entries(labels).map(([key, value]) => (
                  <label-edit-row key={key}>
                    <span>{key}:</span>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleLabelChange(key, e.target.value)}
                    />
                  </label-edit-row>
                ))
              ) : (
                <hint-text>
                  {Object.values(labels).join(', ')}
                </hint-text>
              )}
            </form-row>
          )}

          {detectedBackend === 'onnx' && (onnxFile || isEditing) && (
            <form-row>
              <label>{labels ? 'label.json で上書き' : 'label.json'}</label>
              <input
                type="file"
                accept=".json"
                ref={labelInputRef}
                onChange={handleLabelFile}
              />
            </form-row>
          )}

          {detectedBackend === 'tfjs' && (
            <form-row>
              <label>画像サイズ</label>
              <input
                type="number"
                value={tfjsImageSize}
                onChange={(e) => setTfjsImageSize(Number(e.target.value))}
                min={1}
                style={{ width: 80 }}
              />
            </form-row>
          )}
        </>
      )}

      {error && <error-text>{error}</error-text>}

      {showForm && (
        <button-group>
          <button
            primary=""
            onClick={handleSave}
            disabled={loading}
          >
            {loading
              ? (isEditing ? '更新中...' : '登録中...')
              : (isEditing ? '更新' : '登録')}
          </button>
          {isEditing && (
            <button
              onClick={onDone}
              disabled={loading}
            >
              キャンセル
            </button>
          )}
        </button-group>
      )}
    </model-form>
  );
}
