import type { RiskSummaryResponse } from '../../shared/types';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000';
export const PRO_TOKEN_KEY = 'r3_pro_token';

// ── Token helpers ──────────────────────────────────────────────────────────

export async function getProToken(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.storage.local.get([PRO_TOKEN_KEY], result => {
      resolve((result[PRO_TOKEN_KEY] as string | undefined) ?? null);
    });
  });
}

export async function setProToken(token: string): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.local.set({ [PRO_TOKEN_KEY]: token }, resolve);
  });
}

export async function clearProToken(): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.local.remove([PRO_TOKEN_KEY], resolve);
  });
}

const PRO_EMAIL_KEY = 'r3_pro_email';

export async function getProEmail(): Promise<string> {
  const result = await chrome.storage.local.get(PRO_EMAIL_KEY);
  return (result[PRO_EMAIL_KEY] as string) ?? '';
}

// ── Base fetch ─────────────────────────────────────────────────────────────

/** Throws 'NO_TOKEN' if token missing — caller should fall back to guest mode. */
async function backendFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getProToken();
  if (!token) throw new Error('NO_TOKEN');
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

// ── Response types ─────────────────────────────────────────────────────────

export interface PostStatusResponse {
  post_id: string;
  subreddit: string;
  status: 'visible' | 'removed' | 'unknown';
  visible_to_public: boolean;
  reason_hint:
    | 'missing_from_listing'
    | 'deleted_by_author'
    | 'fetch_failed'
    | 'insufficient_signal'
    | null;
  checked_at: string;
  cached: boolean;
}

export interface RiskFactor {
  type: string;
  impact: 'high' | 'medium' | 'low';
  message: string;
}

export interface RiskResponse {
  subreddit: string;
  username: string;
  risk_level: 'low' | 'medium' | 'high';
  confidence: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  recommendation: string;
  cached: boolean;
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function fetchPostStatus(
  postId: string,
  subreddit: string
): Promise<PostStatusResponse> {
  const params = new URLSearchParams({ post_id: postId, subreddit });
  const resp = await backendFetch(`/api/v1/post-status?${params}`);
  if (resp.status === 401) throw new Error('UNAUTHORIZED');
  if (resp.status === 429) {
    const body = await resp.json() as { error: string; retry_after: number };
    throw new Error(`RATE_LIMITED:${body.retry_after}`);
  }
  if (!resp.ok) throw new Error(`POST_STATUS_ERROR:${resp.status}`);
  return resp.json() as Promise<PostStatusResponse>;
}

export async function fetchRisk(
  subreddit: string,
  username: string,
  postType: 'text' | 'link' | 'image' | 'video' | 'unknown' = 'unknown'
): Promise<RiskResponse> {
  const resp = await backendFetch('/api/v1/risk', {
    method: 'POST',
    body: JSON.stringify({ subreddit, username, post_type: postType }),
  });
  if (resp.status === 401) throw new Error('UNAUTHORIZED');
  if (resp.status === 429) {
    const body = await resp.json() as { error: string; retry_after: number };
    throw new Error(`RATE_LIMITED:${body.retry_after}`);
  }
  if (!resp.ok) throw new Error(`RISK_ERROR:${resp.status}`);
  return resp.json() as Promise<RiskResponse>;
}

export async function fetchRiskSummary(
  subreddit: string,
  username: string
): Promise<RiskSummaryResponse> {
  const params = new URLSearchParams({ subreddit, username });
  const resp = await fetch(`${BACKEND_URL}/api/v1/risk-summary?${params}`);
  if (!resp.ok) throw new Error(`RISK_SUMMARY_ERROR:${resp.status}`);
  return resp.json() as Promise<RiskSummaryResponse>;
}
