import { useState, useEffect } from 'react';
import { getProToken, fetchRisk } from '../api/backendClient';
import type { RiskResponse, RiskFactor } from '../api/backendClient';

interface Props {
  subreddit: string;
  username: string | null;
}

type State =
  | { type: 'no_token' }
  | { type: 'no_username' }
  | { type: 'loading' }
  | { type: 'success'; data: RiskResponse }
  | { type: 'rate_limited'; retryAfter: number }
  | { type: 'error'; message: string };

const RISK_COLORS = { low: '#4caf50', medium: '#ff9800', high: '#cc3300' };
const IMPACT_COLORS = { high: '#cc3300', medium: '#ff9800', low: '#888' };

export function RiskCard({ subreddit, username }: Props) {
  const [state, setState] = useState<State>({ type: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = await getProToken();
      if (!token) {
        if (!cancelled) setState({ type: 'no_token' });
        return;
      }
      if (!username) {
        if (!cancelled) setState({ type: 'no_username' });
        return;
      }

      setState({ type: 'loading' });

      try {
        const data = await fetchRisk(subreddit, username);
        if (!cancelled) setState({ type: 'success', data });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg.startsWith('RATE_LIMITED:')) {
          const retryAfter = parseInt(msg.split(':')[1] ?? '', 10);
          if (!isNaN(retryAfter)) {
            setState({ type: 'rate_limited', retryAfter });
          } else {
            setState({ type: 'error', message: 'Service unavailable. Try again later.' });
          }
        } else if (msg === 'UNAUTHORIZED') {
          setState({ type: 'no_token' });
        } else {
          setState({ type: 'error', message: 'Service unavailable. Try again later.' });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [subreddit, username]);

  return (
    <div className="r3-section">
      <div className="r3-section__heading">Posting Risk</div>
      <RiskBody state={state} />
    </div>
  );
}

function RiskBody({ state }: { state: State }) {
  if (state.type === 'no_token') {
    return (
      <div className="r3-pro-card">
        <div className="r3-pro-overlay">
          <span className="r3-pro-badge">Pro</span>
          <span className="r3-pro-cta">Unlock to see your real risk score</span>
        </div>
      </div>
    );
  }

  if (state.type === 'no_username') {
    return (
      <div style={{ padding: '8px 0', fontSize: 13, color: '#7c7c7c' }}>
        Sign in to Reddit to check your posting risk.
      </div>
    );
  }

  if (state.type === 'loading') {
    return (
      <div style={{ padding: '8px 0', fontSize: 13, color: '#7c7c7c' }}>
        Analyzing risk…
      </div>
    );
  }

  if (state.type === 'rate_limited') {
    return (
      <div style={{ padding: '8px 0', fontSize: 13, color: '#7c7c7c' }}>
        Too many checks. Try again in {state.retryAfter}s.
      </div>
    );
  }

  if (state.type === 'error') {
    return (
      <div style={{ padding: '8px 0', fontSize: 13, color: '#cc3300' }}>
        {state.message}
      </div>
    );
  }

  const { data } = state;

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          className={`r3-risk-level r3-risk-level--${data.risk_level}`}
          style={{ color: RISK_COLORS[data.risk_level] }}
        >
          {data.risk_level.charAt(0).toUpperCase() + data.risk_level.slice(1)}
        </span>
        <span style={{ fontSize: 11, color: '#aaa' }}>
          {data.confidence} confidence
        </span>
        {data.cached && <span style={{ fontSize: 11, color: '#aaa' }}>cached</span>}
      </div>

      {data.factors.length > 0 && (
        <ul style={{ fontSize: 12, color: '#7c7c7c', marginTop: 4, paddingLeft: 16 }}>
          {data.factors.map((f: RiskFactor, i: number) => (
            <li key={i} style={{ marginBottom: 2, color: IMPACT_COLORS[f.impact] }}>
              {f.message}
            </li>
          ))}
        </ul>
      )}

      <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
        {data.recommendation}
      </div>
    </div>
  );
}
