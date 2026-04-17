import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chromeStore so storage.ts functions work in tests
const store = new Map<string, string>();
vi.mock('../../src/panel/storage-adapter', () => ({
  initChromeStore: vi.fn().mockResolvedValue(undefined),
  chromeStore: {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    get length() { return store.size; },
    key: vi.fn((index: number) => [...store.keys()][index] ?? null),
    keysWithPrefix: vi.fn((prefix: string) => [...store.keys()].filter(k => k.startsWith(prefix))),
  },
}));

import { fetchRules } from '../../src/panel/api/rulesClient';
import * as storage from '../../src/panel/storage';
import type { SubredditRule } from '../../src/shared/types';

const mockRules: SubredditRule[] = [
  { kind: 'all', shortName: 'Be kind', description: 'Be nice', priority: 1 },
];

const mockRedditResponse = {
  rules: [
    { kind: 'all', short_name: 'Be kind', description: 'Be nice', priority: 1 },
  ],
};

beforeEach(() => {
  store.clear();
  vi.restoreAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchRules', () => {
  it('fetches from network and caches when no cached data', async () => {
    const setRulesSpy = vi.spyOn(storage, 'setRules');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockRedditResponse),
    } as Response);

    const result = await fetchRules('javascript');
    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.rules).toEqual(mockRules);
      expect(result.stale).toBe(false);
    }
    expect(setRulesSpy).toHaveBeenCalledWith('javascript', mockRules);
  });

  it('returns cached data immediately when fresh', async () => {
    vi.spyOn(storage, 'getRules').mockReturnValue({
      rules: mockRules,
      fetchedAt: Date.now(),
      stale: false,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await fetchRules('javascript');
    expect(result.status).toBe('loaded');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns stale data immediately and triggers background re-fetch when cache is stale', async () => {
    vi.spyOn(storage, 'getRules').mockReturnValue({
      rules: mockRules,
      fetchedAt: Date.now() - 25 * 60 * 60 * 1000,
      stale: true,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockRedditResponse),
    } as Response);

    const result = await fetchRules('javascript');
    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.stale).toBe(true);
    }
    await vi.runAllTimersAsync();
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('returns not-found error on 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    } as Response);

    const result = await fetchRules('nonexistent');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.errorType).toBe('not-found');
    }
  });

  it('deduplicates in-flight requests for same subreddit', async () => {
    let resolveFirst!: () => void;
    const firstFetch = new Promise<Response>((resolve) => {
      resolveFirst = () =>
        resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockRedditResponse),
        } as Response);
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(firstFetch);

    const p1 = fetchRules('javascript');
    const p2 = fetchRules('javascript');
    resolveFirst();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it('returns network error and retries once on failure', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network fail'))
      .mockRejectedValueOnce(new Error('network fail again'));

    const resultPromise = fetchRules('javascript');
    await vi.advanceTimersByTimeAsync(2000);
    const result = await resultPromise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.errorType).toBe('network');
    }
  });

  it('returns empty when rules array is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ rules: [] }),
    } as Response);

    const result = await fetchRules('javascript');
    expect(result.status).toBe('empty');
  });
});
