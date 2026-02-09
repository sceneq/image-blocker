import { useState } from 'react';
import type { StoredModel } from '@/shared/types';
import { deleteModelBinary } from '@/lib/model-store';
import ModelList from './ModelList';
import ModelForm from './ModelForm';

interface Props {
  models: StoredModel[];
  onModelsChange: (models: StoredModel[]) => void;
  usedModelIds: Set<string>;
}

export default function ModelManager({ models, onModelsChange, usedModelIds }: Props) {
  const [editingModel, setEditingModel] = useState<StoredModel | null>(null);

  const handleDelete = async (id: string) => {
    if (usedModelIds.has(id)) {
      if (!confirm('このモデルはルールで使用されています。削除するとそのルールは動作しなくなります。削除しますか？')) {
        return;
      }
    }

    await deleteModelBinary(id);
    onModelsChange(models.filter((m) => m.id !== id));
  };

  return (
    <details shadow="">
      <summary><h2>モデル</h2></summary>

      <ModelList
        models={models}
        onEdit={setEditingModel}
        onDelete={handleDelete}
        editingModelId={editingModel?.id ?? null}
      />

      <ModelForm
        editingModel={editingModel}
        models={models}
        onModelsChange={onModelsChange}
        onDone={() => setEditingModel(null)}
      />
    </details>
  );
}
