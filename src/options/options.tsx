import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { getPrefs, setPrefs, clearAllData } from '../panel/storage';
import { clearLogs } from '../shared/logger';
import type { UserPrefs } from '../shared/types';

const GUEST_USERNAME = 'guest';

function OptionsApp() {
  const [prefs, setPrefsState] = useState<UserPrefs>({
    enabled: true,
    collapsedByDefault: false,
    guestMode: false,
  });
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    setPrefsState(getPrefs(GUEST_USERNAME));
  }, []);

  function updatePref<K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) {
    const updated = { ...prefs, [key]: value };
    setPrefsState(updated);
    setPrefs(GUEST_USERNAME, updated);
  }

  function handleClearData() {
    clearAllData();
    clearLogs();
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  }

  return (
    <div style={{ maxWidth: 480, margin: '48px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 32, color: '#1a1a1b' }}>
        R3 Settings
      </h1>

      <section style={{ background: '#fff', borderRadius: 8, border: '1px solid #edeff1', padding: 24, marginBottom: 24 }}>
        <ToggleSetting
          label="Extension enabled"
          description="Show the R3 panel on Reddit"
          value={prefs.enabled}
          onChange={(v) => updatePref('enabled', v)}
        />
        <ToggleSetting
          label="Collapsed by default"
          description="Start the panel in collapsed state"
          value={prefs.collapsedByDefault}
          onChange={(v) => updatePref('collapsedByDefault', v)}
        />
        <ToggleSetting
          label="Guest mode"
          description="Ignore detected Reddit username"
          value={prefs.guestMode}
          onChange={(v) => updatePref('guestMode', v)}
        />
      </section>

      <section style={{ background: '#fff', borderRadius: 8, border: '1px solid #edeff1', padding: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Clear cached data</div>
        <div style={{ fontSize: 13, color: '#7c7c7c', marginBottom: 16 }}>
          Removes all cached subreddit rules, notes, and logs stored by R3.
        </div>
        <button
          onClick={handleClearData}
          style={{
            padding: '8px 20px',
            background: cleared ? '#4caf50' : '#cc3300',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {cleared ? 'Cleared!' : 'Clear all data'}
        </button>
      </section>
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#7c7c7c' }}>{description}</div>
      </div>
      <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background: value ? '#ff4500' : '#ccc',
            borderRadius: 12,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        />
        <span
          style={{
            position: 'absolute',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            top: 3,
            left: value ? 23 : 3,
            transition: 'left 0.2s',
          }}
        />
      </label>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<OptionsApp />);
