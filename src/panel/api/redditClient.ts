/**
 * Direct Reddit JSON client — replaces the FastAPI backend for risk and post-status.
 *
 * All endpoints used here are Reddit's unauthenticated public JSON surface
 * (the same URLs any browser fetches). No API key, no OAuth, no PRAW needed.
 *
 * Risk-scoring logic mirrors backend/app/services/risk_service.py exactly.
 * Post-status logic mirrors backend/app/services/post_status_service.py exactly.
 */

import type { RiskSummaryResponse } from '../../shared/types';

// ── Response types ────────────────────────────────────────────────────────────

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

export interface PostStatusResponse {
  post_id: string;
  subreddit: string;
  status: 'visible' | 'removed' | 'unknown';
  visible_to_public: boolean;
  reason_hint: 'missing_from_listing' | 'deleted_by_author' | 'fetch_failed' | 'insufficient_signal' | null;
  checked_at: string;
  cached: boolean;
}

// ── Simple TTL cache ──────────────────────────────────────────────────────────

interface CacheEntry<T> { data: T; expiresAt: number }

class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    return entry.data;
  }
  set(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }
}

const riskCache      = new TTLCache<RiskResponse>();
const statusCache    = new TTLCache<PostStatusResponse>();
const userCache      = new TTLCache<UserData>();
const subMetaCache   = new TTLCache<SubredditMeta>();

const RISK_TTL_MS       = 5  * 60 * 1000;  // 5 min
const STATUS_TTL_MS     = 2  * 60 * 1000;  // 2 min
const USER_TTL_MS       = 10 * 60 * 1000;  // 10 min
const SUB_META_TTL_MS   = 60 * 60 * 1000;  // 1 hour

// ── In-flight deduplication ───────────────────────────────────────────────────

const inFlight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

// ── Internal data types ───────────────────────────────────────────────────────

interface UserData {
  karma: number;
  accountAgeDays: number;
}

interface SubredditMeta {
  flairRequired: boolean;
  karmaThreshold: number | null;
  accountAgeDays: number | null;
}

// ── Reddit fetch helpers ──────────────────────────────────────────────────────

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,50}$/;

async function fetchUserData(username: string): Promise<UserData | null> {
  const cached = userCache.get(username);
  if (cached) return cached;
  try {
    const resp = await fetch(`https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`);
    if (!resp.ok) return null;
    const json = await resp.json() as { data?: { link_karma?: number; comment_karma?: number; created_utc?: number } };
    const d = json.data;
    if (!d) return null;
    const data: UserData = {
      karma: (d.link_karma ?? 0) + (d.comment_karma ?? 0),
      accountAgeDays: Math.floor((Date.now() - (d.created_utc ?? 0) * 1000) / 86_400_000),
    };
    userCache.set(username, data, USER_TTL_MS);
    return data;
  } catch {
    return null;
  }
}

function parseAutomodThresholds(text: string): { karma?: number; ageDays?: number } {
  const karmaMatch = text.match(/(?:combined_karma|link_karma|comment_karma)\s*[<>]?\s*(\d+)/);
  const ageMatch   = text.match(/account_age\s*[<>]?\s*(\d+)\s*(?:day|days)/);
  return {
    karma:   karmaMatch ? parseInt(karmaMatch[1], 10) : undefined,
    ageDays: ageMatch   ? parseInt(ageMatch[1],   10) : undefined,
  };
}

async function fetchSubredditMeta(subreddit: string): Promise<SubredditMeta> {
  const cached = subMetaCache.get(subreddit);
  if (cached) return cached;

  const meta: SubredditMeta = { flairRequired: false, karmaThreshold: null, accountAgeDays: null };

  try {
    const resp = await fetch(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/about.json`);
    if (resp.ok) {
      const json = await resp.json() as { data?: { link_flair_required?: boolean } };
      meta.flairRequired = json.data?.link_flair_required ?? false;
    }
  } catch { /* degrade gracefully */ }

  try {
    const resp = await fetch(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/wiki/automoderator.json`);
    if (resp.ok) {
      const json = await resp.json() as { data?: { content_md?: string } };
      const thresholds = parseAutomodThresholds(json.data?.content_md ?? '');
      meta.karmaThreshold  = thresholds.karma   ?? null;
      meta.accountAgeDays  = thresholds.ageDays ?? null;
    }
  } catch { /* automod not accessible — degrade gracefully */ }

  subMetaCache.set(subreddit, meta, SUB_META_TTL_MS);
  return meta;
}

// ── Risk computation (mirrors risk_service.py) ────────────────────────────────

function computeRisk(
  subreddit: string,
  username: string,
  userData: UserData | null,
  subMeta: SubredditMeta,
): Omit<RiskResponse, 'cached'> {
  const factors: RiskFactor[] = [];
  let signalsTotal = 0;
  let signalsAvailable = 0;

  if (subMeta.karmaThreshold !== null) {
    signalsTotal++;
    if (userData) {
      signalsAvailable++;
      if (userData.karma < subMeta.karmaThreshold) {
        factors.push({
          type: 'karma',
          impact: 'high',
          message: `User karma (${userData.karma}) may be below the subreddit threshold (~${subMeta.karmaThreshold}).`,
        });
      }
    }
  }

  if (subMeta.accountAgeDays !== null) {
    signalsTotal++;
    if (userData) {
      signalsAvailable++;
      if (userData.accountAgeDays < subMeta.accountAgeDays) {
        factors.push({
          type: 'account_age',
          impact: 'high',
          message: `Account age (${userData.accountAgeDays} days) may be below the subreddit threshold (~${subMeta.accountAgeDays} days).`,
        });
      }
    }
  }

  if (subMeta.flairRequired) {
    signalsTotal++;
    signalsAvailable++;
    factors.push({
      type: 'flair_required',
      impact: 'medium',
      message: 'This subreddit requires post flair. Make sure to select flair before posting.',
    });
  }

  const highCount = factors.filter(f => f.impact === 'high').length;
  const medCount  = factors.filter(f => f.impact === 'medium').length;
  const riskLevel: 'low' | 'medium' | 'high' =
    highCount >= 2 ? 'high' : highCount >= 1 || medCount >= 2 ? 'medium' : 'low';

  const ratio = signalsTotal === 0 ? 0 : signalsAvailable / signalsTotal;
  const confidence: 'low' | 'medium' | 'high' =
    signalsTotal === 0 ? 'low' : ratio >= 0.7 ? 'high' : ratio >= 0.4 ? 'medium' : 'low';

  let recommendation =
    riskLevel === 'high'   ? 'High removal risk. Address the flagged factors before posting.'
    : riskLevel === 'medium' ? 'Moderate removal risk. Review flagged factors before posting.'
    : "Low removal risk. Your post appears likely to meet this subreddit's requirements.";

  if (confidence === 'low') recommendation += ' (Low confidence — limited subreddit data available.)';

  return { subreddit, username, risk_level: riskLevel, confidence, factors, recommendation };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchRisk(subreddit: string, username: string): Promise<RiskResponse> {
  const key = `risk:${subreddit}:${username}`;
  const cached = riskCache.get(key);
  if (cached) return { ...cached, cached: true };

  return dedupe(key, async () => {
    const [userData, subMeta] = await Promise.all([
      fetchUserData(username),
      fetchSubredditMeta(subreddit),
    ]);
    const result: RiskResponse = { ...computeRisk(subreddit, username, userData, subMeta), cached: false };
    riskCache.set(key, result, RISK_TTL_MS);
    return result;
  }) as Promise<RiskResponse>;
}

export async function fetchRiskSummary(subreddit: string, username: string): Promise<RiskSummaryResponse> {
  const full = await fetchRisk(subreddit, username);
  return { subreddit: full.subreddit, username: full.username, risk_level: full.risk_level, cached: full.cached };
}

export async function fetchPostStatus(postId: string, subreddit: string): Promise<PostStatusResponse> {
  const key = `status:${subreddit}:${postId}`;
  const cached = statusCache.get(key);
  if (cached) return { ...cached, cached: true };

  if (!SAFE_SEGMENT.test(postId) || !SAFE_SEGMENT.test(subreddit)) {
    return { post_id: postId, subreddit, status: 'unknown', visible_to_public: false, reason_hint: 'fetch_failed', checked_at: new Date().toISOString(), cached: false };
  }

  return dedupe(key, async () => {
    const checkedAt = new Date().toISOString();
    try {
      const resp = await fetch(`https://www.reddit.com/r/${subreddit}/comments/${postId}/.json`);
      if (!resp.ok) {
        return { post_id: postId, subreddit, status: 'unknown' as const, visible_to_public: false, reason_hint: 'fetch_failed' as const, checked_at: checkedAt, cached: false };
      }
      type RedditListing = { data: { children: Array<{ data: Record<string, unknown> }> } };
      const data = await resp.json() as [RedditListing, ...unknown[]];
      const postData = data[0].data.children[0].data;
      const isRemoved = postData['removed_by_category'] != null;
      const isDeleted = postData['author'] === '[deleted]';

      const result: PostStatusResponse = isRemoved
        ? { post_id: postId, subreddit, status: 'removed', visible_to_public: false, reason_hint: 'missing_from_listing', checked_at: checkedAt, cached: false }
        : isDeleted
        ? { post_id: postId, subreddit, status: 'removed', visible_to_public: false, reason_hint: 'deleted_by_author', checked_at: checkedAt, cached: false }
        : { post_id: postId, subreddit, status: 'visible', visible_to_public: true, reason_hint: null, checked_at: checkedAt, cached: false };

      statusCache.set(key, result, STATUS_TTL_MS);
      return result;
    } catch {
      return { post_id: postId, subreddit, status: 'unknown' as const, visible_to_public: false, reason_hint: 'fetch_failed' as const, checked_at: checkedAt, cached: false };
    }
  }) as Promise<PostStatusResponse>;
}
