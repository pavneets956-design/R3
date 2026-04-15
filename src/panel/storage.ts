import type { SubredditRule, UserPrefs } from '../shared/types';

export const RULES_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LRU_INDEX_KEY = 'v1:subreddit:_lru';
const MAX_CACHED_SUBREDDITS = 100;

// ─── Key builders ────────────────────────────────────────────────────────────

export function buildRulesDataKey(subreddit: string): string {
  return `v1:subreddit:${subreddit}:rules:data`;
}

export function buildRulesFetchedAtKey(subreddit: string): string {
  return `v1:subreddit:${subreddit}:rules:fetchedAt`;
}

export function buildNotesKey(username: string | null, subreddit: string): string {
  return `v1:user:${username ?? 'guest'}:subreddit:${subreddit}:notes`;
}

export function buildPrefsKey(username: string): string {
  return `v1:user:${username}:prefs`;
}

// ─── LRU index ───────────────────────────────────────────────────────────────

function getLruIndex(): string[] {
  try {
    const raw = localStorage.getItem(LRU_INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveLruIndex(index: string[]): void {
  localStorage.setItem(LRU_INDEX_KEY, JSON.stringify(index));
}

function touchLru(subreddit: string): void {
  const index = getLruIndex().filter((s) => s !== subreddit);
  index.push(subreddit);

  if (index.length > MAX_CACHED_SUBREDDITS) {
    const evicted = index.shift()!;
    localStorage.removeItem(buildRulesDataKey(evicted));
    localStorage.removeItem(buildRulesFetchedAtKey(evicted));
  }

  saveLruIndex(index);
}

// ─── Rules cache ─────────────────────────────────────────────────────────────

export function getRules(
  subreddit: string
): { rules: SubredditRule[]; fetchedAt: number; stale: boolean } | null {
  const raw = localStorage.getItem(buildRulesDataKey(subreddit));
  const fetchedAtRaw = localStorage.getItem(buildRulesFetchedAtKey(subreddit));

  if (!raw || !fetchedAtRaw) return null;

  try {
    const rules = JSON.parse(raw) as SubredditRule[];
    const fetchedAt = Number(fetchedAtRaw);
    const stale = Date.now() - fetchedAt > RULES_TTL_MS;
    return { rules, fetchedAt, stale };
  } catch {
    return null;
  }
}

export function setRules(subreddit: string, rules: SubredditRule[]): void {
  touchLru(subreddit);
  localStorage.setItem(buildRulesDataKey(subreddit), JSON.stringify(rules));
  localStorage.setItem(buildRulesFetchedAtKey(subreddit), String(Date.now()));
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export function getNotes(username: string | null, subreddit: string): string {
  return localStorage.getItem(buildNotesKey(username, subreddit)) ?? '';
}

export function setNotes(username: string | null, subreddit: string, text: string): void {
  localStorage.setItem(buildNotesKey(username, subreddit), text);
}

// ─── Prefs ───────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: UserPrefs = { enabled: true, collapsedByDefault: false, guestMode: false };

export function getPrefs(username: string): UserPrefs {
  try {
    const raw = localStorage.getItem(buildPrefsKey(username));
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<UserPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setPrefs(username: string, prefs: UserPrefs): void {
  localStorage.setItem(buildPrefsKey(username), JSON.stringify(prefs));
}

// ─── Meta ────────────────────────────────────────────────────────────────────

const META_INSTALLED_KEY = 'v1:meta:installed';

export function isInstalled(): boolean {
  return localStorage.getItem(META_INSTALLED_KEY) === '1';
}

export function markInstalled(): void {
  localStorage.setItem(META_INSTALLED_KEY, '1');
}

// ─── Clear all ───────────────────────────────────────────────────────────────

export function clearAllData(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('v1:')) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
