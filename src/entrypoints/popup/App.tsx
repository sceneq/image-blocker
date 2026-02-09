import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '@/shared/storage';
import type { FilterRule } from '@/shared/types';

function App() {
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [activeRule, setActiveRule] = useState<FilterRule | null>(null);
  const [otherMatched, setOtherMatched] = useState<FilterRule[]>([]);
  const [noMatch, setNoMatch] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      setGlobalEnabled(settings.globalEnabled);

      // Get the current tab URL and match it against rules
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          const response = await browser.runtime.sendMessage({
            type: 'get-active-rule',
            url: tab.url,
          });
          if (response?.rule) {
            setActiveRule(response.rule);
            setOtherMatched(response.otherMatched ?? []);
          } else {
            setNoMatch(true);
          }
        } else {
          setNoMatch(true);
        }
      } catch {
        setNoMatch(true);
      }

      setLoading(false);
    })();
  }, []);

  const handleToggle = async () => {
    const settings = await getSettings();
    const updated = { ...settings, globalEnabled: !globalEnabled };
    await saveSettings(updated);
    setGlobalEnabled(!globalEnabled);
    browser.runtime.sendMessage({ type: 'settings-changed' }).catch(() => {});
  };

  const openOptions = async () => {
    const optionsUrl = browser.runtime.getURL('options.html');
    await browser.tabs.create({ url: optionsUrl });
    window.close();
  };

  if (loading) return <popup-container>読み込み中...</popup-container>;

  const statusVariant = !globalEnabled ? 'disabled' : activeRule ? 'active' : noMatch ? 'none' : undefined;
  const statusText = !globalEnabled
    ? 'フィルタリング無効'
    : activeRule
      ? `適用中: ${activeRule.name || activeRule.sitePattern}`
      : noMatch
        ? 'このサイトにマッチするルールはありません'
        : null;

  return (
    <popup-container>
      <h1>画像分類フィルタ</h1>

      <toggle-row>
        <toggle-switch>
          <input
            type="checkbox"
            checked={globalEnabled}
            onChange={handleToggle}
          />
          <span className="slider"></span>
        </toggle-switch>
        <toggle-label>
          {globalEnabled ? 'ON' : 'OFF'}
        </toggle-label>
      </toggle-row>

      {statusVariant && statusText && (
        <status-display variant={statusVariant}>{statusText}</status-display>
      )}

      {activeRule && otherMatched.length > 0 && (
        <other-rules>
          <label>他にマッチしたルール (優先度が低い):</label>
          <ul>
            {otherMatched.map((r) => (
              <li key={r.id}>
                {r.name || r.sitePattern}
                <rule-priority> (優先度 {r.priority})</rule-priority>
              </li>
            ))}
          </ul>
        </other-rules>
      )}

      <button is-settings="" onClick={openOptions}>
        設定を開く
      </button>
    </popup-container>
  );
}

export default App;
