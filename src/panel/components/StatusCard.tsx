import { useState, useEffect } from 'react';
import { getProToken, fetchPostStatus } from '../api/backendClient';
import type { PostStatusResponse } from '../api/backendClient';
import { useLicense } from '../contexts/LicenseContext';
import { ProLock } from './ProLock';

interface Props {
  postId: string | null;
  username: string | null;
  subreddit: string;
}

type State =
  | { type: 'no_token' }
  | { type: 'no_post_id' }
  | { type: 'loading' }
  | { type: 'success'; data: PostStatusResponse }
  | { type: 'rate_limited'; retryAfter: number }
  | { type: 'error'; message: string };

const REASON_LABELS: Record<string, string> = {
  missing_from_listing: 'Not visible to logged-out users',
  deleted_by_author: 'Deleted by author',
  fetch_failed: 'Could not check visibility',
  insufficient_signal: 'Insufficient data to determine status',
};

function FreeTierBody() {
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: '#111827' }}>
        Post Removal Detection
      </div>
      <ProLock label="Post visibility status" />
      <ProLock label="Removal reason" />
      <ProLock label="Checked at" />
      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
        Detects silent post removals by moderators.
      </p>
    </div>
  );
}

export function StatusCard({ postId, subreddit }: Props) {
  const { paid } = useLicense();
  const [state, setState] = useState<State>({ type: 'loading' });

  useEffect(() => {
    if (!paid) return;

    let cancelled = false;

    async function load() {
      const token = await getProToken();
      if (!token) {
        if (!cancelled) setState({ type: 'no_token' });
        return;
      }
      if (!postId) {
        if (!cancelled) setState({ type: 'no_post_id' });
        return;
      }

      setState({ type: 'loading' });
      try {
        const data = await fetchPostStatus(postId, subreddit);
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
  }, [paid, postId, subreddit]);

  return (
    <div className="r3-section">
      <div className="r3-section__heading">Post Visibility</div>
      {paid ? <StatusBody state={state} /> : <FreeTierBody />}
    </div>
  );
}

function StatusBody({ state }: { state: State }) {
  if (state.type === 'no_token') {
    return (
      <div className="r3-pro-card">
        <div className="r3-pro-overlay">
          <span className="r3-pro-badge">Pro</span>
          <span className="r3-pro-cta">Unlock to check if your post is visible</span>
        </div>
      </div>
    );
  }

  if (state.type === 'no_post_id') {
    return (
      <div style={{ padding: '8px 0', fontSize: 13, color: '#7c7c7c' }}>
        Submit a post to check its visibility.
      </div>
    );
  }

  if (state.type === 'loading') {
    return (
      <div style={{ padding: '8px 0', fontSize: 13, color: '#7c7c7c' }}>
        Checking visibility…
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
  const statusColor = data.status === 'visible' ? '#4caf50' : data.status === 'removed' ? '#cc3300' : '#888';

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: statusColor, textTransform: 'capitalize' }}>
          {data.status}
        </span>
        {data.cached && (
          <span style={{ fontSize: 11, color: '#aaa' }}>cached</span>
        )}
      </div>
      {data.reason_hint && (
        <div style={{ fontSize: 12, color: '#7c7c7c', marginTop: 4 }}>
          {REASON_LABELS[data.reason_hint] ?? data.reason_hint}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
        Checked {new Date(data.checked_at).toLocaleTimeString()}
      </div>
    </div>
  );
}
