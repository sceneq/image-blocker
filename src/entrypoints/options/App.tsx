import { useState, useEffect } from 'react';
import ModelManager from '@/components/ModelManager';
import RuleEditor from '@/components/RuleEditor';
import { getSettings, saveSettings } from '@/shared/storage';
import type { Settings, StoredModel, FilterRule } from '@/shared/types';

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return <options-container>読み込み中...</options-container>;

  const persist = async (updated: Settings) => {
    setSettings(updated);
    await saveSettings(updated);
    // Notify Background of the change
    browser.runtime.sendMessage({ type: 'settings-changed' }).catch(() => {});
  };

  const handleModelsChange = (models: StoredModel[]) => {
    persist({ ...settings, models });
  };

  const handleRulesChange = (rules: FilterRule[]) => {
    persist({ ...settings, rules });
  };

  const handleGlobalToggle = () => {
    persist({ ...settings, globalEnabled: !settings.globalEnabled });
  };

  const usedModelIds = new Set(settings.rules.map((r) => r.modelId));

  return (
    <options-container>
      <h1>画像分類フィルタ - 設定</h1>

      <card-section>
        <toggle-row>
          <toggle-switch>
            <input
              type="checkbox"
              checked={settings.globalEnabled}
              onChange={handleGlobalToggle}
            />
            <span className="slider"></span>
          </toggle-switch>
          <toggle-label>
            拡張機能 {settings.globalEnabled ? 'ON' : 'OFF'}
          </toggle-label>
        </toggle-row>
      </card-section>

      <ModelManager
        models={settings.models}
        onModelsChange={handleModelsChange}
        usedModelIds={usedModelIds}
      />

      <RuleEditor
        rules={settings.rules}
        models={settings.models}
        onRulesChange={handleRulesChange}
      />
    </options-container>
  );
}
