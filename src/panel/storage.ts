import type { SubredditRule, UserPrefs } from '../shared/types';
import { chromeStore } from './storage-adapter';

export const RULES_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LRU_INDEX_KEY = 'v1:subreddit:_lru';
const MAX_CACHED_SUBREDDITS = 100;

// --- Key builders ---

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

// --- LRU index ---

function getLruIndex(): string[] {
  try {
    const raw = chromeStore.getItem(LRU_INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveLruIndex(index: string[]): void {
  chromeStore.setItem(LRU_INDEX_KEY, JSON.stringify(index));
}

function touchLru(subreddit: string): void {
  const index = getLruIndex().filter((s) => s !== subreddit);
  index.push(subreddit);

  if (index.length > MAX_CACHED_SUBREDDITS) {
    const evicted = index.shift()!;
    chromeStore.removeItem(buildRulesDataKey(evicted));
    chromeStore.removeItem(buildRulesFetchedAtKey(evicted));
  }

  saveLruIndex(index);
}

// --- Rules cache ---

export function getRules(
  subreddit: string
): { rules: SubredditRule[]; fetchedAt: number; stale: boolean } | null {
  const raw = chromeStore.getItem(buildRulesDataKey(subreddit));
  const fetchedAtRaw = chromeStore.getItem(buildRulesFetchedAtKey(subreddit));

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
  chromeStore.setItem(buildRulesDataKey(subreddit), JSON.stringify(rules));
  chromeStore.setItem(buildRulesFetchedAtKey(subreddit), String(Date.now()));
}

// --- Notes ---

export function getNotes(username: string | null, subreddit: string): string {
  return chromeStore.getItem(buildNotesKey(username, subreddit)) ?? '';
}

export function setNotes(username: string | null, subreddit: string, text: string): void {
  chromeStore.setItem(buildNotesKey(username, subreddit), text);
}

// --- Prefs ---

const DEFAULT_PREFS: UserPrefs = { enabled: true, collapsedByDefault: false, guestMode: false };

export function getPrefs(username: string): UserPrefs {
  try {
    const raw = chromeStore.getItem(buildPrefsKey(username));
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<UserPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setPrefs(username: string, prefs: UserPrefs): void {
  chromeStore.setItem(buildPrefsKey(username), JSON.stringify(prefs));
}

// --- Meta ---

const META_INSTALLED_KEY = 'v1:meta:installed';

export function isInstalled(): boolean {
  return chromeStore.getItem(META_INSTALLED_KEY) === '1';
}

export function markInstalled(): void {
  chromeStore.setItem(META_INSTALLED_KEY, '1');
}

// --- Clear all ---

/**
 * Clears all cached subreddit data, notes, and preferences.
 * Also removes license/Pro keys so the extension fully resets.
 */
export function clearAllData(): void {
  const keysToRemove = chromeStore.keysWithPrefix('v1:');
  keysToRemove.forEach((k) => chromeStore.removeItem(k));

  // Also clear license keys that live outside the v1: namespace.
  chrome.storage.local.remove(['r3_pro_paid', 'r3_pro_email', 'r3_pro_token']);
}
