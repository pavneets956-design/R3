import { useState, useEffect } from 'react';
import { fetchPostStatus } from '../api/redditClient';
import type { PostStatusResponse } from '../api/redditClient';
import { useLicense } from '../contexts/LicenseContext';
import { ProLock } from './ProLock';

interface Props {
  postId: string | null;
  username: string | null;
  subreddit: string;
}

type State =
  | { type: 'no_post_id' }
  | { type: 'loading' }
  | { type: 'success'; data: PostStatusResponse }
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
        setState({ type: 'error', message: 'Service unavailable. Try again later.' });
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
