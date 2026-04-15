import { useEffect, useRef, useState } from 'react';
import { fetchRisk, fetchRiskSummary } from '../api/backendClient';
import type { RiskResponse } from '../api/backendClient';
import { useLicense } from '../contexts/LicenseContext';
import { ProLock } from './ProLock';
import type { RiskSummaryResponse } from '../../shared/types';

interface Props {
  subreddit: string;
  username: string | null;
}

// Pro tier state machine
type ProState =
  | { type: 'no_username' }
  | { type: 'loading' }
  | { type: 'success'; data: RiskResponse }
  | { type: 'rate_limited'; retryAfter: number }
  | { type: 'error'; message: string };

// Free tier state machine
type FreeState =
  | { type: 'no_username' }
  | { type: 'loading' }
  | { type: 'success'; data: RiskSummaryResponse }
  | { type: 'error' };

const RISK_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

function FreeTierBody({ state }: { state: FreeState }) {
  if (state.type === 'no_username') return <p style={{ color: '#9ca3af', fontSize: 13 }}>Log in to see your risk score.</p>;
  if (state.type === 'loading') return <p style={{ color: '#9ca3af', fontSize: 13 }}>Checking risk…</p>;
  if (state.type === 'error') return <p style={{ color: '#ef4444', fontSize: 13 }}>Could not load risk score.</p>;

  const level = state.data.risk_level;
  const color = RISK_COLORS[level] ?? '#6b7280';

  return (
    <div>
      <div style={{ fontWeight: 700, color, marginBottom: 8, fontSize: 15 }}>
        Account Risk: {level.toUpperCase()}
      </div>
      <ProLock label="Karma ratio" />
      <ProLock label="Account age" />
      <ProLock label="Shadowban check" />
    </div>
  );
}

function ProTierBody({ state }: { state: ProState }) {
  if (state.type === 'no_username') return <p style={{ color: '#9ca3af', fontSize: 13 }}>Log in to see your risk score.</p>;
  if (state.type === 'loading') return <p style={{ color: '#9ca3af', fontSize: 13 }}>Checking risk…</p>;
  if (state.type === 'rate_limited') return <p style={{ color: '#f59e0b', fontSize: 13 }}>Rate limited. Retry in {state.retryAfter}s.</p>;
  if (state.type === 'error') return <p style={{ color: '#ef4444', fontSize: 13 }}>{state.message}</p>;

  const { data } = state;
  const color = RISK_COLORS[data.risk_level] ?? '#6b7280';

  return (
    <div>
      <div style={{ fontWeight: 700, color, marginBottom: 8, fontSize: 15 }}>
        Account Risk: {data.risk_level.toUpperCase()} · {data.confidence} confidence
      </div>
      {data.factors.map((f, i) => (
        <div key={i} style={{ fontSize: 13, marginBottom: 4, color: '#374151' }}>
          • {f.message}
        </div>
      ))}
      {data.recommendation && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
          {data.recommendation}
        </div>
      )}
    </div>
  );
}

export function RiskCard({ subreddit, username }: Props) {
  const { paid, email } = useLicense();
  const [freeState, setFreeState] = useState<FreeState>({ type: 'loading' });
  const [proState, setProState] = useState<ProState>({ type: 'loading' });
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!username) {
      setFreeState({ type: 'no_username' });
      setProState({ type: 'no_username' });
      return;
    }

    cancelRef.current = false;

    if (!paid) {
      // Free tier: fetch summary only
      setFreeState({ type: 'loading' });
      fetchRiskSummary(subreddit, username)
        .then((data) => {
          if (!cancelRef.current) setFreeState({ type: 'success', data });
        })
        .catch(() => {
          if (!cancelRef.current) setFreeState({ type: 'error' });
        });
    } else {
      // Pro tier: fetch full breakdown
      setProState({ type: 'loading' });
      fetchRisk(subreddit, username)
        .then((data) => {
          if (!cancelRef.current) setProState({ type: 'success', data });
        })
        .catch((err: Error) => {
          if (cancelRef.current) return;
          const msg = err.message ?? '';
          if (msg.startsWith('RATE_LIMITED:')) {
            const retryAfter = parseInt(msg.split(':')[1] ?? '60', 10);
            setProState({ type: 'rate_limited', retryAfter });
          } else {
            setProState({ type: 'error', message: 'Service unavailable.' });
          }
        });
    }

    return () => { cancelRef.current = true; };
  }, [subreddit, username, paid, email]);

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: '#111827' }}>
        Account Risk
      </div>
      {paid ? <ProTierBody state={proState} /> : <FreeTierBody state={freeState} />}
    </div>
  );
}
