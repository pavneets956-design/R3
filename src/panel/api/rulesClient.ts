import type { RulesState, SubredditRule } from '../../shared/types';
import { getRules, setRules } from '../storage';
import { logEvent } from '../../shared/logger';

const RETRY_DELAY_MS = 1500;
const MIN_FETCH_INTERVAL_MS = 10_000;

const inFlight: Partial<Record<string, Promise<RulesState>>> = {};
const lastFetchAttempt: Record<string, number> = {};

export function fetchRules(subreddit: string): Promise<RulesState> {
  // Return cached fresh data immediately
  const cached = getRules(subreddit);
  if (cached && !cached.stale) {
    return Promise.resolve<RulesState>({
      status: 'loaded',
      rules: cached.rules,
      fetchedAt: cached.fetchedAt,
      stale: false,
    });
  }

  // Return stale data immediately; background re-fetch
  if (cached && cached.stale) {
    triggerBackgroundFetch(subreddit);
    return Promise.resolve<RulesState>({
      status: 'loaded',
      rules: cached.rules,
      fetchedAt: cached.fetchedAt,
      stale: true,
    });
  }

  // In-flight deduplication
  if (inFlight[subreddit]) return inFlight[subreddit];

  inFlight[subreddit] = doFetch(subreddit).finally(() => {
    delete inFlight[subreddit];
  });

  return inFlight[subreddit];
}

function triggerBackgroundFetch(subreddit: string): void {
  const last = lastFetchAttempt[subreddit] ?? 0;
  const elapsed = Date.now() - last;
  const delay = elapsed < MIN_FETCH_INTERVAL_MS ? MIN_FETCH_INTERVAL_MS - elapsed : 0;

  setTimeout(() => {
    if (!inFlight[subreddit]) {
      inFlight[subreddit] = doFetch(subreddit).finally(() => {
        delete inFlight[subreddit];
      });
    }
  }, delay);
}

async function doFetch(subreddit: string, isRetry = false): Promise<RulesState> {
  lastFetchAttempt[subreddit] = Date.now();

  try {
    const url = `https://www.reddit.com/r/${subreddit}/about/rules.json`;
    const response = await fetch(url);

    if (response.status === 403 || response.status === 451) {
      return { status: 'error', errorType: 'private' };
    }

    if (response.status === 404) {
      return { status: 'error', errorType: 'not-found' };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let data: { rules?: unknown[] };
    try {
      data = (await response.json()) as { rules?: unknown[] };
    } catch {
      logEvent({ type: 'RULES_FETCH_ERROR', subreddit, errorType: 'malformed' });
      return { status: 'error', errorType: 'malformed' };
    }

    if (!Array.isArray(data.rules)) {
      return { status: 'error', errorType: 'malformed' };
    }

    if (data.rules.length === 0) {
      return { status: 'empty' };
    }

    const rules: SubredditRule[] = data.rules.map((r) => {
      const rule = r as Record<string, unknown>;
      return {
        kind: String(rule.kind ?? 'all'),
        shortName: String(rule.short_name ?? ''),
        description: String(rule.description ?? ''),
        priority: Number(rule.priority ?? 0),
      };
    });

    setRules(subreddit, rules);
    return { status: 'loaded', rules, fetchedAt: Date.now(), stale: false };
  } catch (err) {
    if (!isRetry) {
      return new Promise<RulesState>((resolve) => {
        setTimeout(() => {
          resolve(doFetch(subreddit, true));
        }, RETRY_DELAY_MS);
      });
    }

    logEvent({
      type: 'RULES_FETCH_ERROR',
      subreddit,
      errorType: 'network',
      message: err instanceof Error ? err.message : String(err),
    });
    return { status: 'error', errorType: 'network' };
  }
}
