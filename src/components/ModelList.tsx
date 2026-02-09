import type { StoredModel } from '@/shared/types';

interface Props {
  models: StoredModel[];
  onEdit: (model: StoredModel) => void;
  onDelete: (id: string) => void;
  editingModelId: string | null;
}

export default function ModelList({ models, onEdit, onDelete, editingModelId }: Props) {
  if (models.length === 0) {
    return <p style={{ color: '#999', marginBottom: 16 }}>モデルが登録されていません</p>;
  }

  return (
    <details open>
      <summary style={{ cursor: 'pointer', marginBottom: 8, fontSize: 13, color: '#666' }}>
        登録済 ({models.length})
      </summary>
      <ul style={{ listStyle: 'none' }}>
        {models.map((model) => (
          <model-item key={model.id}>
            <model-info>
              <model-name>{model.name}</model-name>
              <model-labels>
                形式: {model.backend === 'tfjs' ? 'TensorFlow.js' : 'ONNX'} | ラベル: {Object.values(model.labels).join(', ')}
              </model-labels>
            </model-info>
            <button-group>
              <button
                onClick={() => onEdit(model)}
                disabled={editingModelId === model.id}
              >
                編集
              </button>
              <button
                danger=""
                onClick={() => onDelete(model.id)}
              >
                削除
              </button>
            </button-group>
          </model-item>
        ))}
      </ul>
    </details>
  );
}
