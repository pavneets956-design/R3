import { useState, useEffect, useCallback } from 'react';
import { fetchRules } from '../api/rulesClient';
import type { RulesState } from '../../shared/types';

interface Props {
  subreddit: string;
}

export function RulesBlock({ subreddit }: Props) {
  const [state, setState] = useState<RulesState>({ status: 'loading' });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    fetchRules(subreddit).then((result) => {
      if (!cancelled) setState(result);
    });

    return () => {
      cancelled = true;
    };
  }, [subreddit, retryKey]);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  return (
    <div className="r3-section">
      <div className="r3-section__heading">
        Subreddit Rules
        {state.status === 'loaded' && state.stale && (
          <span className="r3-stale-badge">stale</span>
        )}
      </div>
      <RulesContent state={state} onRetry={retry} />
    </div>
  );
}

function RulesContent({ state, onRetry }: { state: RulesState; onRetry: () => void }) {
  if (state.status === 'loading') {
    return <div className="r3-state">Loading rules…</div>;
  }

  if (state.status === 'empty') {
    return <div className="r3-state">No rules posted for this subreddit.</div>;
  }

  if (state.status === 'error') {
    const message = {
      network: "Couldn't load rules.",
      'not-found': 'Rules unavailable for this subreddit.',
      private: 'This subreddit is private — rules unavailable.',
      malformed: "Couldn't load rules.",
    }[state.errorType];

    return (
      <div className="r3-state r3-state--error">
        {message}
        {(state.errorType === 'network' || state.errorType === 'malformed') && (
          <div>
            <button className="r3-state__retry" onClick={onRetry} aria-label="Retry loading rules">
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  if (state.status === 'loaded') {
    return (
      <ul className="r3-rules__list">
        {state.rules.map((rule) => (
          <li key={`${rule.shortName}-${rule.priority}`} className="r3-rules__item">
            <div className="r3-rules__item-title">{rule.shortName}</div>
          </li>
        ))}
      </ul>
    );
  }

  return null;
}
