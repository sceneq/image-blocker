import { useState, useRef } from 'react';
import type { FilterRule, StoredModel, PendingStyle } from '@/shared/types';
import WeightSlider from './WeightSlider';

interface Props {
  rules: FilterRule[];
  models: StoredModel[];
  onRulesChange: (rules: FilterRule[]) => void;
}

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export default function RuleEditor({ rules, models, onRulesChange }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragAllowed = useRef(false);

  const addRule = () => {
    if (models.length === 0) return;

    const model = models[0];
    const defaultWeights: Record<string, number> = {};
    for (const labelName of Object.values(model.labels)) {
      defaultWeights[labelName] = 0;
    }

    const newRule: FilterRule = {
      id: crypto.randomUUID(),
      name: '',
      sitePattern: 'https?://.*',
      modelId: model.id,
      weights: defaultWeights,
      pendingStyle: 'pulse',
      blockThreshold: 0.5,
      blockEnabled: true,
      enabled: true,
      priority: 0,
    };
    onRulesChange([...rules, newRule]);
  };

  const updateRule = (index: number, partial: Partial<FilterRule>) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], ...partial };
    onRulesChange(updated);
  };

  const deleteRule = (index: number) => {
    onRulesChange(rules.filter((_, i) => i !== index));
  };

  const handleModelChange = (index: number, modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (!model) return;

    const weights: Record<string, number> = {};
    for (const labelName of Object.values(model.labels)) {
      weights[labelName] = rules[index].weights[labelName] ?? 0;
    }
    updateRule(index, { modelId, weights });
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const reordered = [...rules];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    onRulesChange(reordered);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    dragAllowed.current = false;
  };

  return (
    <details shadow="">
      <summary><h2>フィルタルール</h2></summary>
      <hint-text style={{ marginBottom: 12 }}>
        優先度の数値が小さいルールが優先して適用されます。同じ優先度のルールは上から順に評価されます。ドラッグで順序を変更できます。
      </hint-text>

      {rules.length === 0 ? (
        <p style={{ color: '#999', marginBottom: 16 }}>ルールがありません</p>
      ) : (
        <ul style={{ listStyle: 'none' }}>
          {rules.map((rule, index) => {
            const model = models.find((m) => m.id === rule.modelId);
            const patternValid = isValidRegex(rule.sitePattern);

            return (
              <rule-item
                key={rule.id}
                disabled={rule.enabled ? undefined : ''}
                draggable
                onDragStart={(e: React.DragEvent) => {
                  if (!dragAllowed.current) {
                    e.preventDefault();
                    return;
                  }
                  handleDragStart(index);
                }}
                onDragOver={(e: React.DragEvent) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              >
                <rule-header>
                  <drag-handle
                    onMouseDown={() => { dragAllowed.current = true; }}
                  >&#x2630;</drag-handle>
                  <span style={{ flex: 1, fontWeight: 600 }}>
                    {rule.name || `ルール ${index + 1}`}
                  </span>
                  <toggle-switch style={{ marginRight: 8 }}>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => updateRule(index, { enabled: e.target.checked })}
                    />
                    <span className="slider"></span>
                  </toggle-switch>
                  <button
                    danger=""
                    onClick={() => deleteRule(index)}
                  >
                    削除
                  </button>
                </rule-header>

                <rule-fields>
                  <div>
                    <label>ルール名</label>
                    <input
                      type="text"
                      value={rule.name}
                      placeholder={`ルール ${index + 1}`}
                      onChange={(e) => updateRule(index, { name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label>サイトパターン (正規表現)</label>
                    <input
                      type="text"
                      invalid={patternValid ? undefined : ''}
                      value={rule.sitePattern}
                      onChange={(e) => updateRule(index, { sitePattern: e.target.value })}
                      placeholder="例: .*\.reddit\.com"
                    />
                    {!patternValid && (
                      <validation-error>無効な正規表現です</validation-error>
                    )}
                  </div>

                  <div>
                    <label>優先度 (小さい値が優先)</label>
                    <input
                      type="number"
                      value={rule.priority}
                      onChange={(e) => updateRule(index, { priority: Number(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label>モデル</label>
                    <select
                      value={rule.modelId}
                      onChange={(e) => handleModelChange(index, e.target.value)}
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                      {!model && (
                        <option value={rule.modelId} disabled>
                          (モデルが見つかりません)
                        </option>
                      )}
                    </select>
                  </div>

                  {model && (
                    <div>
                      <label>重み設定</label>
                      <WeightSlider
                        labels={model.labels}
                        weights={rule.weights}
                        onChange={(weights) => updateRule(index, { weights })}
                      />
                    </div>
                  )}

                  <div>
                    <label>推論中の表示</label>
                    <select
                      value={rule.pendingStyle}
                      onChange={(e) => updateRule(index, { pendingStyle: e.target.value as PendingStyle })}
                    >
                      <option value="pulse">半透明 (パルス)</option>
                      <option value="hidden">非表示 (シルエット)</option>
                    </select>
                  </div>

                  <div>
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.blockEnabled ?? true}
                        onChange={(e) => updateRule(index, { blockEnabled: e.target.checked })}
                      />
                      {' '}ブロック閾値 (この値以上で完全非表示 + クリックで表示)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="range"
                        min="0" max="1" step="0.05"
                        value={rule.blockThreshold}
                        disabled={!(rule.blockEnabled ?? true)}
                        onChange={(e) => updateRule(index, { blockThreshold: parseFloat(e.target.value) })}
                      />
                      <span>{rule.blockThreshold.toFixed(2)}</span>
                    </div>
                  </div>
                </rule-fields>
              </rule-item>
            );
          })}
        </ul>
      )}

      <button
        primary=""
        onClick={addRule}
        disabled={models.length === 0}
      >
        ルールを追加
      </button>
      {models.length === 0 && (
        <hint-text style={{ marginLeft: 8 }}>
          先にモデルを登録してください
        </hint-text>
      )}
    </details>
  );
}
