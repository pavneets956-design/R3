import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildRulesDataKey,
  buildRulesFetchedAtKey,
  buildNotesKey,
  buildPrefsKey,
  getRules,
  setRules,
  getNotes,
  setNotes,
  getPrefs,
  setPrefs,
  isInstalled,
  markInstalled,
  clearAllData,
  RULES_TTL_MS,
} from '../../src/panel/storage';
import type { SubredditRule, UserPrefs } from '../../src/shared/types';

const mockRules: SubredditRule[] = [
  { kind: 'all', shortName: 'Be kind', description: 'Be kind to others', priority: 1 },
];

const defaultPrefs: UserPrefs = { enabled: true, collapsedByDefault: false, guestMode: false };

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('key builders', () => {
  it('builds rules data key', () => {
    expect(buildRulesDataKey('javascript')).toBe('v1:subreddit:javascript:rules:data');
  });

  it('builds rules fetchedAt key', () => {
    expect(buildRulesFetchedAtKey('javascript')).toBe('v1:subreddit:javascript:rules:fetchedAt');
  });

  it('builds notes key for user', () => {
    expect(buildNotesKey('alice', 'javascript')).toBe('v1:user:alice:subreddit:javascript:notes');
  });

  it('builds notes key for guest', () => {
    expect(buildNotesKey(null, 'javascript')).toBe('v1:user:guest:subreddit:javascript:notes');
  });

  it('builds prefs key', () => {
    expect(buildPrefsKey('alice')).toBe('v1:user:alice:prefs');
  });
});

describe('rules cache', () => {
  it('returns null when no cached data', () => {
    expect(getRules('javascript')).toBeNull();
  });

  it('returns cached rules with stale=false when fresh', () => {
    setRules('javascript', mockRules);
    const result = getRules('javascript');
    expect(result).not.toBeNull();
    expect(result!.rules).toEqual(mockRules);
    expect(result!.stale).toBe(false);
  });

  it('returns cached rules with stale=true when TTL expired', () => {
    setRules('javascript', mockRules);
    // Simulate time passing past TTL
    const pastTime = Date.now() - RULES_TTL_MS - 1000;
    localStorage.setItem(buildRulesFetchedAtKey('javascript'), String(pastTime));
    const result = getRules('javascript');
    expect(result).not.toBeNull();
    expect(result!.stale).toBe(true);
  });

  it('evicts LRU entry when 101st subreddit cached', () => {
    for (let i = 0; i < 100; i++) {
      setRules(`sub${i}`, mockRules);
    }
    // sub0 is the oldest — should be evicted when sub100 is added
    setRules('sub100', mockRules);
    expect(getRules('sub0')).toBeNull();
    expect(getRules('sub100')).not.toBeNull();
  });
});

describe('notes', () => {
  it('returns empty string when no notes', () => {
    expect(getNotes('alice', 'javascript')).toBe('');
  });

  it('round-trips notes', () => {
    setNotes('alice', 'javascript', 'my note');
    expect(getNotes('alice', 'javascript')).toBe('my note');
  });

  it('uses guest key when username is null', () => {
    setNotes(null, 'javascript', 'guest note');
    expect(getNotes(null, 'javascript')).toBe('guest note');
  });
});

describe('prefs', () => {
  it('returns default prefs when none stored', () => {
    expect(getPrefs('alice')).toEqual(defaultPrefs);
  });

  it('round-trips prefs', () => {
    const custom: UserPrefs = { enabled: false, collapsedByDefault: true, guestMode: true };
    setPrefs('alice', custom);
    expect(getPrefs('alice')).toEqual(custom);
  });
});

describe('meta', () => {
  it('isInstalled returns false initially', () => {
    expect(isInstalled()).toBe(false);
  });

  it('isInstalled returns true after markInstalled', () => {
    markInstalled();
    expect(isInstalled()).toBe(true);
  });
});

describe('clearAllData', () => {
  it('removes all v1: keys from localStorage', () => {
    setRules('javascript', mockRules);
    setNotes('alice', 'javascript', 'note');
    clearAllData();
    expect(getRules('javascript')).toBeNull();
    expect(getNotes('alice', 'javascript')).toBe('');
  });
});
