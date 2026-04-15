# R3 Extension Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working MV3 browser extension that injects a floating React panel into Reddit, displaying subreddit rules (live), mocked risk/visibility cards (Pro-locked), and per-subreddit notes (persisted to localStorage).

**Architecture:** Content script detects page context from DOM and broadcasts it via an in-process bridge to a React app mounted inside a Shadow DOM host on `document.body`. All styles live in a single `panel.css` injected as raw text into the shadow root (bypasses Reddit's global styles). Storage and fetch logic are plain TypeScript modules imported by the React tree.

**Tech Stack:** React 18, TypeScript 5, Vite 5, vite-plugin-web-extension, Vitest 2, React Testing Library, jsdom, CSS (BEM-prefixed, injected inline into Shadow DOM)

---

## File Map

| File | Responsibility |
|---|---|
| `manifest.json` | MV3 manifest — declares entry points, permissions, host_permissions |
| `vite.config.ts` | Extension build via vite-plugin-web-extension |
| `vitest.config.ts` | Test runner config (jsdom, globals, setup file) |
| `tsconfig.json` | TypeScript config |
| `tests/setup.ts` | @testing-library/jest-dom matchers |
| `src/shared/types.ts` | `PageContext`, `LogEvent`, `RulesResult`, `SubredditRule` interfaces |
| `src/shared/logger.ts` | `logEvent()` — writes to `v1:logs` rolling 500-entry array |
| `src/panel/storage.ts` | Key builders, TTL read/write, LRU eviction (100-sub cap) |
| `src/content/detector.ts` | Reads DOM → returns `PageContext` |
| `src/content/watcher.ts` | `MutationObserver` watching URL changes, debounced 300ms |
| `src/content/bridge.ts` | In-process pub/sub between content script and React |
| `src/content/index.ts` | Wires watcher + detector + bridge; mount guard |
| `src/panel/api/rulesClient.ts` | Fetch, cache (stale-while-revalidate), dedup, rate-limit, retry |
| `src/panel/api/apiClient.ts` | Stubbed Phase 2 hooks (risk score, visibility — return mocked data) |
| `src/panel/main.tsx` | Shadow DOM host + React root mount; imports `panel.css?inline` |
| `src/panel/panel.css` | All panel styles — BEM, `r3-` prefix |
| `src/panel/hooks/usePageContext.ts` | Subscribes to bridge; only re-renders on subreddit/pageType change |
| `src/panel/components/PanelHeader.tsx` | Logo, username badge, collapse toggle |
| `src/panel/components/RulesBlock.tsx` | Rules fetch orchestration + 5 render states |
| `src/panel/components/RiskCard.tsx` | Mocked risk score + Pro lock overlay |
| `src/panel/components/StatusCard.tsx` | Mocked visibility status + Pro lock overlay |
| `src/panel/components/NotesBlock.tsx` | Textarea persisted to storage, debounced 300ms, 4096 char cap |
| `src/panel/components/PanelFooter.tsx` | Link to options page |
| `src/panel/components/FloatingPanel.tsx` | Root panel — adapts layout per pageType, first-install welcome state |
| `src/background/index.ts` | Service worker stub (lifecycle only) |
| `src/options/options.html` | Options page HTML shell |
| `src/options/options.tsx` | Options page React app (4 settings + clear cache) |
| `tests/unit/storage.test.ts` | Key builders, TTL, LRU eviction |
| `tests/unit/detector.test.ts` | PageContext from mocked DOM for each pageType |
| `tests/unit/watcher.test.ts` | Debounce, fires once per URL change |
| `tests/unit/rulesClient.test.ts` | Fetch/cache/retry/dedup/rate-limit |
| `tests/components/PanelHeader.test.tsx` | Username shown; "Guest" when null |
| `tests/components/RulesBlock.test.tsx` | All 5 states |
| `tests/components/RiskCard.test.tsx` | Mocked data renders; Pro lock present |
| `tests/components/StatusCard.test.tsx` | Mocked data renders; Pro lock present |
| `tests/components/NotesBlock.test.tsx` | Persistence, debounce, char cap |
| `tests/components/FloatingPanel.test.tsx` | Collapse/expand; layout per pageType; first-install state |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `manifest.json`
- Create: `tests/setup.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "r3-extension",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/chrome": "^0.0.270",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vite-plugin-web-extension": "^4.1.1",
    "vitest": "^2.0.3"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: 'manifest.json',
    }),
  ],
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 5: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "R3 — Reddit Rules & Requirements",
  "version": "0.1.0",
  "description": "See subreddit rules and post intelligence before you submit.",
  "content_scripts": [
    {
      "matches": ["https://www.reddit.com/*"],
      "js": ["src/content/index.ts"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "options_ui": {
    "page": "src/options/options.html",
    "open_in_tab": true
  },
  "permissions": ["storage"],
  "host_permissions": [
    "https://www.reddit.com/*"
  ],
  "web_accessible_resources": [
    {
      "resources": ["assets/*"],
      "matches": ["https://www.reddit.com/*"]
    }
  ]
}
```

- [ ] **Step 6: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 7: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors (no source files yet — that's fine).

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json vite.config.ts vitest.config.ts manifest.json tests/setup.ts package-lock.json
git commit -m "feat: project scaffold — vite, react, vitest, mv3 manifest"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: Create `src/shared/types.ts`**

```ts
export interface PageContext {
  username: string | null;
  subreddit: string | null;
  pageType: 'feed' | 'post' | 'submit' | 'profile' | 'other';
  postComposerOpen: boolean;
  postId: string | null;
  url: string;
  detectedAt: number;
}

export interface LogEvent {
  type: string;
  subreddit?: string;
  username?: string;
  errorType?: string;
  message?: string;
  timestamp: number;
}

export interface SubredditRule {
  kind: string;
  shortName: string;
  description: string;
  priority: number;
}

export type RulesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; rules: SubredditRule[]; fetchedAt: number; stale: boolean }
  | { status: 'error'; errorType: 'network' | 'not-found' | 'private' | 'malformed' }
  | { status: 'empty' };

export interface UserPrefs {
  enabled: boolean;
  collapsedByDefault: boolean;
  guestMode: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: shared types — PageContext, LogEvent, RulesState, UserPrefs"
```

---

## Task 3: Logger

**Files:**
- Create: `src/shared/logger.ts`

No unit test for logger — it's a thin localStorage wrapper; storage.test.ts covers the pattern.

- [ ] **Step 1: Create `src/shared/logger.ts`**

```ts
import type { LogEvent } from './types';

const LOG_KEY = 'v1:logs';
const MAX_ENTRIES = 500;

export function logEvent(event: Omit<LogEvent, 'timestamp'>): void {
  const entry: LogEvent = { ...event, timestamp: Date.now() };

  try {
    const raw = localStorage.getItem(LOG_KEY);
    const logs: LogEvent[] = raw ? (JSON.parse(raw) as LogEvent[]) : [];
    logs.push(entry);
    if (logs.length > MAX_ENTRIES) logs.shift();
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch {
    // Never let logging break the extension
  }
}

export function getLogs(): LogEvent[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as LogEvent[]) : [];
  } catch {
    return [];
  }
}

export function clearLogs(): void {
  localStorage.removeItem(LOG_KEY);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/logger.ts
git commit -m "feat: logger — rolling 500-entry log to localStorage"
```

---

## Task 4: Storage

**Files:**
- Create: `src/panel/storage.ts`
- Create: `tests/unit/storage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/storage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/storage.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/panel/storage.ts`**

```ts
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/unit/storage.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/panel/storage.ts tests/unit/storage.test.ts
git commit -m "feat: storage — key builders, TTL cache, LRU eviction, notes, prefs"
```

---

## Task 5: Detector

**Files:**
- Create: `src/content/detector.ts`
- Create: `tests/unit/detector.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/detector.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { detectPageContext } from '../../src/content/detector';

function setUrl(url: string) {
  Object.defineProperty(window, 'location', {
    value: new URL(url),
    writable: true,
  });
}

function setMetaUsername(username: string | null) {
  document.querySelectorAll('meta[name="x-reddit-logged-in"]').forEach((el) => el.remove());
  document.querySelectorAll('[data-testid="header-user-links"] a[href*="/user/"]').forEach((el) =>
    el.remove()
  );

  if (username) {
    const link = document.createElement('a');
    link.setAttribute('data-testid', 'header-user-links-username');
    link.setAttribute('href', `/user/${username}`);
    link.textContent = username;
    document.body.appendChild(link);
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.title = '';
});

describe('detectPageContext', () => {
  it('detects feed page on /r/javascript/', () => {
    setUrl('https://www.reddit.com/r/javascript/');
    const ctx = detectPageContext();
    expect(ctx.subreddit).toBe('javascript');
    expect(ctx.pageType).toBe('feed');
    expect(ctx.postId).toBeNull();
  });

  it('detects post page on /r/javascript/comments/abc123/', () => {
    setUrl('https://www.reddit.com/r/javascript/comments/abc123/some_post/');
    const ctx = detectPageContext();
    expect(ctx.subreddit).toBe('javascript');
    expect(ctx.pageType).toBe('post');
    expect(ctx.postId).toBe('abc123');
  });

  it('detects submit page on /r/javascript/submit', () => {
    setUrl('https://www.reddit.com/r/javascript/submit');
    const ctx = detectPageContext();
    expect(ctx.subreddit).toBe('javascript');
    expect(ctx.pageType).toBe('submit');
  });

  it('detects profile page on /user/alice/', () => {
    setUrl('https://www.reddit.com/user/alice/');
    const ctx = detectPageContext();
    expect(ctx.pageType).toBe('profile');
    expect(ctx.subreddit).toBeNull();
  });

  it('detects other page on /r/ root', () => {
    setUrl('https://www.reddit.com/r/');
    const ctx = detectPageContext();
    expect(ctx.pageType).toBe('other');
    expect(ctx.subreddit).toBeNull();
  });

  it('detects postComposerOpen when composer element present', () => {
    setUrl('https://www.reddit.com/r/javascript/');
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'post-composer');
    document.body.appendChild(el);
    const ctx = detectPageContext();
    expect(ctx.postComposerOpen).toBe(true);
  });

  it('postComposerOpen is false when no composer element', () => {
    setUrl('https://www.reddit.com/r/javascript/');
    const ctx = detectPageContext();
    expect(ctx.postComposerOpen).toBe(false);
  });

  it('returns null username when no user link found', () => {
    setUrl('https://www.reddit.com/r/javascript/');
    const ctx = detectPageContext();
    expect(ctx.username).toBeNull();
  });

  it('detects username from header link', () => {
    setUrl('https://www.reddit.com/r/javascript/');
    setMetaUsername('alice');
    const ctx = detectPageContext();
    expect(ctx.username).toBe('alice');
  });

  it('includes current url and detectedAt', () => {
    setUrl('https://www.reddit.com/r/javascript/');
    const before = Date.now();
    const ctx = detectPageContext();
    expect(ctx.url).toBe('https://www.reddit.com/r/javascript/');
    expect(ctx.detectedAt).toBeGreaterThanOrEqual(before);
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/unit/detector.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/content/detector.ts`**

```ts
import type { PageContext } from '../shared/types';

/**
 * Reads the current DOM and URL to produce a PageContext.
 * Prefer data-testid and role attributes over class names.
 * Returns safe defaults if detection fails for any field.
 */
export function detectPageContext(): PageContext {
  const url = window.location.href;
  const pathname = window.location.pathname;

  return {
    username: detectUsername(),
    subreddit: detectSubreddit(pathname),
    pageType: detectPageType(pathname),
    postComposerOpen: detectPostComposerOpen(),
    postId: detectPostId(pathname),
    url,
    detectedAt: Date.now(),
  };
}

function detectUsername(): string | null {
  // New Reddit: header link with data-testid containing username
  const link = document.querySelector<HTMLAnchorElement>(
    '[data-testid="header-user-links-username"]'
  );
  if (link) {
    const href = link.getAttribute('href') ?? '';
    const match = href.match(/^\/user\/([^/]+)/);
    if (match) return match[1];
    // Fallback: text content if href parse fails
    const text = link.textContent?.trim();
    if (text) return text;
  }
  return null;
}

function detectSubreddit(pathname: string): string | null {
  const match = pathname.match(/^\/r\/([^/]+)/);
  if (!match) return null;
  const name = match[1];
  // Bare "/r/" with no subreddit name
  if (!name) return null;
  return name;
}

function detectPageType(
  pathname: string
): PageContext['pageType'] {
  if (/^\/user\//.test(pathname)) return 'profile';

  const subredditMatch = pathname.match(/^\/r\/([^/]+)(\/(.*))?$/);
  if (!subredditMatch) return 'other';

  const sub = subredditMatch[1];
  if (!sub) return 'other';

  const rest = subredditMatch[3] ?? '';

  if (rest === '' || rest === '/') return 'feed';
  if (rest.startsWith('comments/')) return 'post';
  if (rest === 'submit' || rest.startsWith('submit')) return 'submit';

  return 'feed';
}

function detectPostComposerOpen(): boolean {
  return !!document.querySelector('[data-testid="post-composer"]');
}

function detectPostId(pathname: string): string | null {
  const match = pathname.match(/\/comments\/([a-z0-9]+)\//i);
  return match ? match[1] : null;
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/unit/detector.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/detector.ts tests/unit/detector.test.ts
git commit -m "feat: detector — DOM reading to PageContext for all page types"
```

---

## Task 6: Watcher

**Files:**
- Create: `src/content/watcher.ts`
- Create: `tests/unit/watcher.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/watcher.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startWatcher, stopWatcher } from '../../src/content/watcher';

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'location', {
    value: { href: 'https://www.reddit.com/r/javascript/' },
    writable: true,
  });
});

afterEach(() => {
  stopWatcher();
  vi.useRealTimers();
});

describe('startWatcher', () => {
  it('calls callback on URL change after debounce', () => {
    const callback = vi.fn();
    startWatcher(callback);

    // Simulate URL change
    (window.location as { href: string }).href = 'https://www.reddit.com/r/python/';

    // Fire MutationObserver callback manually (jsdom doesn't auto-fire)
    // The watcher checks URL on each mutation
    const observer = (globalThis as { __r3_observer__?: MutationObserver }).__r3_observer__;
    if (observer) {
      observer.takeRecords(); // flush
    }

    // Not called yet — debounce pending
    expect(callback).not.toHaveBeenCalled();

    // Advance past debounce
    vi.advanceTimersByTime(350);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('fires callback only once for rapid mutations at same URL', () => {
    const callback = vi.fn();
    startWatcher(callback);

    // Multiple mutations but same URL
    vi.advanceTimersByTime(350);
    expect(callback).toHaveBeenCalledTimes(0); // URL didn't change
  });

  it('stopWatcher prevents further callbacks', () => {
    const callback = vi.fn();
    startWatcher(callback);
    stopWatcher();

    (window.location as { href: string }).href = 'https://www.reddit.com/r/python/';
    vi.advanceTimersByTime(350);
    expect(callback).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/unit/watcher.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/content/watcher.ts`**

```ts
const DEBOUNCE_MS = 300;

type UrlChangeCallback = (url: string) => void;

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastUrl: string = '';

export function startWatcher(onUrlChange: UrlChangeCallback): void {
  stopWatcher();
  lastUrl = window.location.href;

  observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) return;

    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      lastUrl = currentUrl;
      onUrlChange(currentUrl);
      debounceTimer = null;
    }, DEBOUNCE_MS);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Expose for testing
  (globalThis as { __r3_observer__?: MutationObserver }).__r3_observer__ = observer;
}

export function stopWatcher(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (observer !== null) {
    observer.disconnect();
    observer = null;
  }
  (globalThis as { __r3_observer__?: MutationObserver }).__r3_observer__ = undefined;
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/unit/watcher.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/watcher.ts tests/unit/watcher.test.ts
git commit -m "feat: watcher — MutationObserver with 300ms URL-change debounce"
```

---

## Task 7: Bridge

**Files:**
- Create: `src/content/bridge.ts`

No separate test — `usePageContext` tests (Task 12) exercise this fully.

- [ ] **Step 1: Create `src/content/bridge.ts`**

```ts
import type { PageContext } from '../shared/types';

type Listener = (ctx: PageContext) => void;

const listeners = new Set<Listener>();

export const bridge = {
  emit(ctx: PageContext): void {
    listeners.forEach((fn) => fn(ctx));
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** For testing: reset all subscribers */
  _reset(): void {
    listeners.clear();
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/content/bridge.ts
git commit -m "feat: bridge — in-process pub/sub for PageContext updates"
```

---

## Task 8: Content Script Entry + Mount Guard

**Files:**
- Create: `src/content/index.ts`

- [ ] **Step 1: Create `src/content/index.ts`**

```ts
import { startWatcher } from './watcher';
import { detectPageContext } from './detector';
import { bridge } from './bridge';
import { logEvent } from '../shared/logger';

declare global {
  interface Window {
    __R3_PANEL_MOUNTED__: boolean | undefined;
  }
}

async function mountPanel(): Promise<void> {
  if (window.__R3_PANEL_MOUNTED__) return;
  window.__R3_PANEL_MOUNTED__ = true;

  // Dynamically import the React panel to keep initial parse cost low
  const { mountR3Panel } = await import('../panel/main');
  mountR3Panel();

  logEvent({ type: 'PANEL_MOUNTED', url: window.location.href });
}

function init(): void {
  // Emit initial context on load
  const initialCtx = detectPageContext();
  bridge.emit(initialCtx);

  // Mount the panel
  mountPanel().catch((err: unknown) => {
    logEvent({
      type: 'PANEL_MOUNT_ERROR',
      message: err instanceof Error ? err.message : String(err),
    });
  });

  // Watch for SPA navigation
  startWatcher(() => {
    const ctx = detectPageContext();
    bridge.emit(ctx);
    logEvent({ type: 'NAV_DETECTED', url: ctx.url, subreddit: ctx.subreddit ?? undefined });
  });
}

init();
```

- [ ] **Step 2: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: content entry — mount guard, bridge emit on nav, watcher start"
```

---

## Task 9: Rules Client

**Files:**
- Create: `src/panel/api/rulesClient.ts`
- Create: `tests/unit/rulesClient.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/rulesClient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  localStorage.clear();
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
      fetchedAt: Date.now() - 25 * 60 * 60 * 1000, // 25h ago
      stale: true,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockRedditResponse),
    } as Response);

    const result = await fetchRules('javascript');
    // Returns stale data immediately
    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.stale).toBe(true);
    }
    // Background fetch is triggered (but async — just check fetch was called)
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
    // Advance past retry delay (1500ms)
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
      json: () => Promise.resolve({ rules: [] }),
    } as Response);

    const result = await fetchRules('javascript');
    expect(result.status).toBe('empty');
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/unit/rulesClient.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/panel/api/rulesClient.ts`**

```ts
import type { RulesState, SubredditRule } from '../../shared/types';
import { getRules, setRules } from '../storage';
import { logEvent } from '../../shared/logger';

const RETRY_DELAY_MS = 1500;
const MIN_FETCH_INTERVAL_MS = 10_000;

const inFlight: Record<string, Promise<RulesState>> = {};
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
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/unit/rulesClient.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/panel/api/rulesClient.ts tests/unit/rulesClient.test.ts
git commit -m "feat: rules client — fetch, stale-while-revalidate, dedup, rate-limit, retry"
```

---

## Task 10: API Client (Mocked Stubs)

**Files:**
- Create: `src/panel/api/apiClient.ts`

No tests — these are pure mocks returning hardcoded data. Phase 2 swaps implementations.

- [ ] **Step 1: Create `src/panel/api/apiClient.ts`**

```ts
/** Phase 1: all calls return mocked data. Phase 2 replaces these with real backend calls. */

export interface RiskScore {
  level: 'low' | 'medium' | 'high';
  factors: string[];
}

export interface VisibilityStatus {
  visible: boolean | null;
  checkedAt: number | null;
  message: string;
}

export async function getRiskScore(
  _subreddit: string,
  _username: string | null
): Promise<RiskScore> {
  // Mocked — Pro feature
  return {
    level: 'medium',
    factors: ['Account age below threshold', 'Karma may be insufficient'],
  };
}

export async function getVisibilityStatus(
  _postId: string,
  _username: string | null
): Promise<VisibilityStatus> {
  // Mocked — Pro feature
  return {
    visible: null,
    checkedAt: null,
    message: 'Unlock Pro to check post visibility',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/panel/api/apiClient.ts
git commit -m "feat: api client stubs — mocked risk score and visibility for Phase 1"
```

---

## Task 11: Panel CSS + Shadow DOM Mount

**Files:**
- Create: `src/panel/panel.css`
- Create: `src/panel/main.tsx`

- [ ] **Step 1: Create `src/panel/panel.css`**

```css
/* R3 Panel — all panel styles; injected into Shadow DOM, not document head */
/* BEM naming with r3- prefix prevents any mental collision with Reddit styles */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.r3-host {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 320px;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  color: #1a1a1b;
}

.r3-panel {
  background: #ffffff;
  border: 1px solid #edeff1;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.r3-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #ff4500;
  color: #fff;
  user-select: none;
}

.r3-header__title {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.5px;
}

.r3-header__username {
  font-size: 12px;
  opacity: 0.9;
}

.r3-header__toggle {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  line-height: 1;
}

/* Body */
.r3-body {
  overflow-y: auto;
  flex: 1;
}

/* Section */
.r3-section {
  padding: 12px;
  border-bottom: 1px solid #edeff1;
}

.r3-section:last-child {
  border-bottom: none;
}

.r3-section__heading {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #7c7c7c;
  margin-bottom: 8px;
}

/* Rules */
.r3-rules__list {
  list-style: none;
}

.r3-rules__item {
  padding: 6px 0;
  border-bottom: 1px solid #f2f2f2;
  line-height: 1.4;
}

.r3-rules__item:last-child {
  border-bottom: none;
}

.r3-rules__item-title {
  font-weight: 600;
  font-size: 13px;
}

/* States */
.r3-state {
  padding: 12px;
  text-align: center;
  color: #7c7c7c;
  font-size: 13px;
}

.r3-state--error {
  color: #cc3300;
}

.r3-state__retry {
  margin-top: 8px;
  padding: 4px 12px;
  background: none;
  border: 1px solid #cc3300;
  border-radius: 4px;
  color: #cc3300;
  cursor: pointer;
  font-size: 12px;
}

.r3-stale-badge {
  display: inline-block;
  font-size: 10px;
  color: #7c7c7c;
  background: #f2f2f2;
  border-radius: 4px;
  padding: 1px 5px;
  margin-left: 6px;
}

/* Pro lock overlay */
.r3-pro-card {
  position: relative;
  min-height: 72px;
}

.r3-pro-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 4px;
}

.r3-pro-badge {
  font-size: 11px;
  font-weight: 700;
  color: #ff4500;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  background: #fff3f0;
  border: 1px solid #ff4500;
  border-radius: 4px;
  padding: 1px 6px;
}

.r3-pro-cta {
  font-size: 12px;
  color: #7c7c7c;
}

/* Risk / Status mock content */
.r3-risk-level {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  margin-bottom: 4px;
}

.r3-risk-level--medium {
  background: #fff3cd;
  color: #856404;
}

/* Notes */
.r3-notes__textarea {
  width: 100%;
  resize: vertical;
  min-height: 80px;
  border: 1px solid #edeff1;
  border-radius: 4px;
  padding: 8px;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.4;
}

.r3-notes__textarea:focus {
  outline: 2px solid #ff4500;
  outline-offset: 1px;
}

.r3-notes__count {
  text-align: right;
  font-size: 11px;
  color: #7c7c7c;
  margin-top: 4px;
}

/* Footer */
.r3-footer {
  padding: 8px 12px;
  border-top: 1px solid #edeff1;
  text-align: center;
}

.r3-footer__link {
  font-size: 12px;
  color: #7c7c7c;
  text-decoration: none;
}

.r3-footer__link:hover {
  text-decoration: underline;
}

/* Welcome state */
.r3-welcome {
  padding: 16px 12px;
  text-align: center;
}

.r3-welcome__title {
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 8px;
  color: #ff4500;
}

.r3-welcome__body {
  font-size: 13px;
  color: #7c7c7c;
  line-height: 1.5;
}

/* Minimal mode */
.r3-minimal {
  padding: 16px 12px;
  text-align: center;
  color: #7c7c7c;
  font-size: 13px;
}
```

- [ ] **Step 2: Create `src/panel/main.tsx`**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import panelStyles from './panel.css?inline';
import { FloatingPanel } from './components/FloatingPanel';
import { markInstalled, isInstalled } from './storage';
import { logEvent } from '../shared/logger';

export function mountR3Panel(): void {
  // Mount guard — idempotent
  if (document.getElementById('__r3-host__')) return;

  if (!isInstalled()) {
    markInstalled();
    logEvent({ type: 'FIRST_INSTALL' });
  }

  const host = document.createElement('div');
  host.id = '__r3-host__';
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });

  // Inject styles into shadow root (isolates from Reddit's global CSS)
  const style = document.createElement('style');
  style.textContent = panelStyles;
  shadowRoot.appendChild(style);

  const container = document.createElement('div');
  shadowRoot.appendChild(container);

  const root = createRoot(container);
  root.render(<FloatingPanel />);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/panel/panel.css src/panel/main.tsx
git commit -m "feat: shadow DOM mount — injects styles and React root into shadow root"
```

---

## Task 12: usePageContext Hook

**Files:**
- Create: `src/panel/hooks/usePageContext.ts`

- [ ] **Step 1: Create `src/panel/hooks/usePageContext.ts`**

```ts
import { useState, useEffect } from 'react';
import { bridge } from '../../content/bridge';
import type { PageContext } from '../../shared/types';

/**
 * Subscribes to bridge updates.
 * Only triggers a re-render when subreddit or pageType changes.
 * Other fields (url, detectedAt, postComposerOpen, postId) do not cause re-renders
 * unless a component explicitly reads them via a separate subscription.
 */
export function usePageContext(): PageContext | null {
  const [ctx, setCtx] = useState<PageContext | null>(null);

  useEffect(() => {
    return bridge.subscribe((next) => {
      setCtx((prev) => {
        if (
          prev !== null &&
          prev.subreddit === next.subreddit &&
          prev.pageType === next.pageType
        ) {
          return prev; // No re-render
        }
        return next;
      });
    });
  }, []);

  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/panel/hooks/usePageContext.ts
git commit -m "feat: usePageContext — bridge subscription with subreddit/pageType render guard"
```

---

## Task 13: PanelHeader Component

**Files:**
- Create: `src/panel/components/PanelHeader.tsx`
- Create: `tests/components/PanelHeader.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/PanelHeader.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelHeader } from '../../src/panel/components/PanelHeader';

describe('PanelHeader', () => {
  it('shows detected username', () => {
    render(
      <PanelHeader username="alice" collapsed={false} onToggleCollapse={vi.fn()} />
    );
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('shows "Guest" when username is null', () => {
    render(
      <PanelHeader username={null} collapsed={false} onToggleCollapse={vi.fn()} />
    );
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });

  it('calls onToggleCollapse when toggle button clicked', async () => {
    const onToggle = vi.fn();
    render(
      <PanelHeader username="alice" collapsed={false} onToggleCollapse={onToggle} />
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows collapse icon when expanded', () => {
    render(
      <PanelHeader username="alice" collapsed={false} onToggleCollapse={vi.fn()} />
    );
    expect(screen.getByRole('button')).toHaveTextContent('−');
  });

  it('shows expand icon when collapsed', () => {
    render(
      <PanelHeader username="alice" collapsed={true} onToggleCollapse={vi.fn()} />
    );
    expect(screen.getByRole('button')).toHaveTextContent('+');
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/components/PanelHeader.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/panel/components/PanelHeader.tsx`**

```tsx
import React from 'react';

interface Props {
  username: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function PanelHeader({ username, collapsed, onToggleCollapse }: Props) {
  return (
    <div className="r3-header">
      <span className="r3-header__title">R3</span>
      <span className="r3-header__username">{username ?? 'Guest'}</span>
      <button
        className="r3-header__toggle"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {collapsed ? '+' : '−'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/components/PanelHeader.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/panel/components/PanelHeader.tsx tests/components/PanelHeader.test.tsx
git commit -m "feat: PanelHeader — username display, collapse toggle"
```

---

## Task 14: RulesBlock Component

**Files:**
- Create: `src/panel/components/RulesBlock.tsx`
- Create: `tests/components/RulesBlock.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/RulesBlock.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesBlock } from '../../src/panel/components/RulesBlock';
import * as rulesClient from '../../src/panel/api/rulesClient';
import type { RulesState } from '../../src/shared/types';

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(state: RulesState) {
  vi.spyOn(rulesClient, 'fetchRules').mockResolvedValue(state);
}

describe('RulesBlock', () => {
  it('shows loading state initially', () => {
    vi.spyOn(rulesClient, 'fetchRules').mockReturnValue(new Promise(() => {}));
    render(<RulesBlock subreddit="javascript" />);
    expect(screen.getByText(/loading rules/i)).toBeInTheDocument();
  });

  it('renders rules when loaded', async () => {
    mockFetch({
      status: 'loaded',
      rules: [{ kind: 'all', shortName: 'Be kind', description: 'Be nice to others', priority: 1 }],
      fetchedAt: Date.now(),
      stale: false,
    });

    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() => expect(screen.getByText('Be kind')).toBeInTheDocument());
  });

  it('shows stale badge when data is stale', async () => {
    mockFetch({
      status: 'loaded',
      rules: [{ kind: 'all', shortName: 'Be kind', description: 'Be nice', priority: 1 }],
      fetchedAt: Date.now() - 25 * 3600 * 1000,
      stale: true,
    });

    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() => expect(screen.getByText(/stale/i)).toBeInTheDocument());
  });

  it('shows network error with retry button', async () => {
    mockFetch({ status: 'error', errorType: 'network' });

    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() => expect(screen.getByText(/couldn't load rules/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows not-found message on 404', async () => {
    mockFetch({ status: 'error', errorType: 'not-found' });

    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() =>
      expect(screen.getByText(/rules unavailable for this subreddit/i)).toBeInTheDocument()
    );
  });

  it('shows private message for private subreddit', async () => {
    mockFetch({ status: 'error', errorType: 'private' });

    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() =>
      expect(screen.getByText(/subreddit is private/i)).toBeInTheDocument()
    );
  });

  it('shows empty message when no rules', async () => {
    mockFetch({ status: 'empty' });

    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() => expect(screen.getByText(/no rules posted/i)).toBeInTheDocument());
  });

  it('re-fetches when retry button clicked', async () => {
    const fetchSpy = vi
      .spyOn(rulesClient, 'fetchRules')
      .mockResolvedValueOnce({ status: 'error', errorType: 'network' })
      .mockResolvedValueOnce({
        status: 'loaded',
        rules: [{ kind: 'all', shortName: 'Be kind', description: 'Be nice', priority: 1 }],
        fetchedAt: Date.now(),
        stale: false,
      });

    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('Be kind')).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/components/RulesBlock.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create `src/panel/components/RulesBlock.tsx`**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
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
          <li key={rule.priority} className="r3-rules__item">
            <div className="r3-rules__item-title">{rule.shortName}</div>
          </li>
        ))}
      </ul>
    );
  }

  return null;
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/components/RulesBlock.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/panel/components/RulesBlock.tsx tests/components/RulesBlock.test.tsx
git commit -m "feat: RulesBlock — all 5 states (loading, loaded, stale, error, empty)"
```

---

## Task 15: RiskCard Component

**Files:**
- Create: `src/panel/components/RiskCard.tsx`
- Create: `tests/components/RiskCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/RiskCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskCard } from '../../src/panel/components/RiskCard';

describe('RiskCard', () => {
  it('renders mocked risk level', () => {
    render(<RiskCard subreddit="javascript" username={null} />);
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });

  it('renders Pro lock overlay', () => {
    render(<RiskCard subreddit="javascript" username={null} />);
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('renders coming soon CTA', () => {
    render(<RiskCard subreddit="javascript" username={null} />);
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/components/RiskCard.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create `src/panel/components/RiskCard.tsx`**

```tsx
import React from 'react';

interface Props {
  subreddit: string;
  username: string | null;
}

export function RiskCard({ subreddit: _subreddit, username: _username }: Props) {
  return (
    <div className="r3-section">
      <div className="r3-section__heading">Posting Risk</div>
      <div className="r3-pro-card">
        {/* Mocked background content */}
        <div style={{ padding: '8px 0', opacity: 0.3 }}>
          <span className="r3-risk-level r3-risk-level--medium">Medium</span>
          <ul style={{ fontSize: 12, color: '#7c7c7c', marginTop: 4 }}>
            <li>Account age may be too low</li>
            <li>Karma threshold not met</li>
          </ul>
        </div>
        {/* Pro lock overlay */}
        <div className="r3-pro-overlay">
          <span className="r3-pro-badge">Pro</span>
          <span className="r3-pro-cta">Unlock to see your real risk score</span>
          <span className="r3-pro-cta" style={{ fontSize: 11 }}>Coming soon</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/components/RiskCard.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/panel/components/RiskCard.tsx tests/components/RiskCard.test.tsx
git commit -m "feat: RiskCard — mocked risk score with Pro lock overlay"
```

---

## Task 16: StatusCard Component

**Files:**
- Create: `src/panel/components/StatusCard.tsx`
- Create: `tests/components/StatusCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/StatusCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusCard } from '../../src/panel/components/StatusCard';

describe('StatusCard', () => {
  it('renders visibility heading', () => {
    render(<StatusCard postId={null} username={null} />);
    expect(screen.getByText(/visibility/i)).toBeInTheDocument();
  });

  it('renders Pro lock overlay', () => {
    render(<StatusCard postId={null} username={null} />);
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('renders coming soon CTA', () => {
    render(<StatusCard postId={null} username={null} />);
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/components/StatusCard.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create `src/panel/components/StatusCard.tsx`**

```tsx
import React from 'react';

interface Props {
  postId: string | null;
  username: string | null;
}

export function StatusCard({ postId: _postId, username: _username }: Props) {
  return (
    <div className="r3-section">
      <div className="r3-section__heading">Post Visibility</div>
      <div className="r3-pro-card">
        {/* Mocked background content */}
        <div style={{ padding: '8px 0', opacity: 0.3 }}>
          <span style={{ fontSize: 13, color: '#7c7c7c' }}>Unknown visibility</span>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Last checked: —</div>
        </div>
        {/* Pro lock overlay */}
        <div className="r3-pro-overlay">
          <span className="r3-pro-badge">Pro</span>
          <span className="r3-pro-cta">Unlock to check if your post is visible</span>
          <span className="r3-pro-cta" style={{ fontSize: 11 }}>Coming soon</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/components/StatusCard.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/panel/components/StatusCard.tsx tests/components/StatusCard.test.tsx
git commit -m "feat: StatusCard — mocked visibility with Pro lock overlay"
```

---

## Task 17: NotesBlock Component

**Files:**
- Create: `src/panel/components/NotesBlock.tsx`
- Create: `tests/components/NotesBlock.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/NotesBlock.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotesBlock } from '../../src/panel/components/NotesBlock';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('NotesBlock', () => {
  it('loads existing notes on mount', () => {
    localStorage.setItem('v1:user:alice:subreddit:javascript:notes', 'my saved note');
    render(<NotesBlock username="alice" subreddit="javascript" />);
    expect(screen.getByRole('textbox')).toHaveValue('my saved note');
  });

  it('shows empty textarea when no saved notes', () => {
    render(<NotesBlock username="alice" subreddit="javascript" />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('persists notes to storage after debounce', async () => {
    render(<NotesBlock username="alice" subreddit="javascript" />);
    const textarea = screen.getByRole('textbox');

    await userEvent.type(textarea, 'hello');
    expect(localStorage.getItem('v1:user:alice:subreddit:javascript:notes')).toBeNull();

    act(() => { vi.advanceTimersByTime(350); });
    expect(localStorage.getItem('v1:user:alice:subreddit:javascript:notes')).toBe('hello');
  });

  it('enforces 4096 character cap', () => {
    render(<NotesBlock username="alice" subreddit="javascript" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '4096');
  });

  it('shows character count', async () => {
    render(<NotesBlock username="alice" subreddit="javascript" />);
    await userEvent.type(screen.getByRole('textbox'), 'hi');
    expect(screen.getByText(/2 \/ 4096/)).toBeInTheDocument();
  });

  it('uses guest key when username is null', async () => {
    render(<NotesBlock username={null} subreddit="javascript" />);
    await userEvent.type(screen.getByRole('textbox'), 'guest note');
    act(() => { vi.advanceTimersByTime(350); });
    expect(localStorage.getItem('v1:user:guest:subreddit:javascript:notes')).toBe('guest note');
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/components/NotesBlock.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create `src/panel/components/NotesBlock.tsx`**

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { getNotes, setNotes } from '../storage';

const MAX_LENGTH = 4096;
const DEBOUNCE_MS = 300;

interface Props {
  username: string | null;
  subreddit: string;
}

export function NotesBlock({ username, subreddit }: Props) {
  const [text, setText] = useState(() => getNotes(username, subreddit));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reload when subreddit/username changes
  useEffect(() => {
    setText(getNotes(username, subreddit));
  }, [username, subreddit]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);

    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setNotes(username, subreddit, value);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  }

  return (
    <div className="r3-section">
      <div className="r3-section__heading">My Notes</div>
      <textarea
        className="r3-notes__textarea"
        value={text}
        onChange={handleChange}
        maxLength={MAX_LENGTH}
        placeholder="Notes about this subreddit…"
      />
      <div className="r3-notes__count">
        {text.length} / {MAX_LENGTH}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/components/NotesBlock.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/panel/components/NotesBlock.tsx tests/components/NotesBlock.test.tsx
git commit -m "feat: NotesBlock — debounced storage, char cap, guest key support"
```

---

## Task 18: PanelFooter Component

**Files:**
- Create: `src/panel/components/PanelFooter.tsx`

No test — it's a single static link.

- [ ] **Step 1: Create `src/panel/components/PanelFooter.tsx`**

```tsx
import React from 'react';

export function PanelFooter() {
  const optionsUrl = chrome.runtime.getURL('src/options/options.html');

  return (
    <div className="r3-footer">
      <a href={optionsUrl} target="_blank" rel="noopener noreferrer" className="r3-footer__link">
        R3 Settings
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/panel/components/PanelFooter.tsx
git commit -m "feat: PanelFooter — link to options page"
```

---

## Task 19: FloatingPanel (Root Component)

**Files:**
- Create: `src/panel/components/FloatingPanel.tsx`
- Create: `tests/components/FloatingPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/FloatingPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloatingPanel } from '../../src/panel/components/FloatingPanel';
import { bridge } from '../../src/content/bridge';
import type { PageContext } from '../../src/shared/types';

// chrome.runtime.getURL not available in jsdom
vi.stubGlobal('chrome', {
  runtime: { getURL: (p: string) => `chrome-extension://fake/${p}` },
});

function makeCtx(overrides: Partial<PageContext> = {}): PageContext {
  return {
    username: 'alice',
    subreddit: 'javascript',
    pageType: 'feed',
    postComposerOpen: false,
    postId: null,
    url: 'https://www.reddit.com/r/javascript/',
    detectedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('v1:meta:installed', '1'); // not first install
  bridge._reset();
  vi.restoreAllMocks();
});

describe('FloatingPanel', () => {
  it('shows first-install welcome when not yet installed', () => {
    localStorage.clear(); // no v1:meta:installed
    render(<FloatingPanel />);
    expect(screen.getByText(/welcome to r3/i)).toBeInTheDocument();
  });

  it('collapses and expands panel body on toggle', async () => {
    render(<FloatingPanel />);
    act(() => { bridge.emit(makeCtx()); });

    const toggle = screen.getByRole('button', { name: /collapse/i });
    await userEvent.click(toggle);
    expect(screen.queryByText(/subreddit rules/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /expand/i }));
    expect(screen.getByText(/subreddit rules/i)).toBeInTheDocument();
  });

  it('shows full panel on feed pageType', () => {
    render(<FloatingPanel />);
    act(() => { bridge.emit(makeCtx({ pageType: 'feed' })); });
    expect(screen.getByText(/subreddit rules/i)).toBeInTheDocument();
    expect(screen.getByText(/posting risk/i)).toBeInTheDocument();
    expect(screen.getByText(/post visibility/i)).toBeInTheDocument();
    expect(screen.getByText(/my notes/i)).toBeInTheDocument();
  });

  it('shows minimal panel on other pageType', () => {
    render(<FloatingPanel />);
    act(() => { bridge.emit(makeCtx({ pageType: 'other', subreddit: null })); });
    expect(screen.getByText(/no subreddit detected/i)).toBeInTheDocument();
    expect(screen.queryByText(/subreddit rules/i)).not.toBeInTheDocument();
  });

  it('shows minimal panel on profile pageType', () => {
    render(<FloatingPanel />);
    act(() => { bridge.emit(makeCtx({ pageType: 'profile', subreddit: null })); });
    expect(screen.queryByText(/subreddit rules/i)).not.toBeInTheDocument();
  });

  it('promotes RiskCard on submit pageType', () => {
    render(<FloatingPanel />);
    act(() => { bridge.emit(makeCtx({ pageType: 'submit' })); });
    // RiskCard should appear before RulesBlock in submit mode
    const headings = screen.getAllByText(/posting risk|subreddit rules/i);
    expect(headings[0]).toHaveTextContent(/posting risk/i);
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/components/FloatingPanel.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create `src/panel/components/FloatingPanel.tsx`**

```tsx
import React, { useState } from 'react';
import { usePageContext } from '../hooks/usePageContext';
import { isInstalled } from '../storage';
import { PanelHeader } from './PanelHeader';
import { RulesBlock } from './RulesBlock';
import { RiskCard } from './RiskCard';
import { StatusCard } from './StatusCard';
import { NotesBlock } from './NotesBlock';
import { PanelFooter } from './PanelFooter';

export function FloatingPanel() {
  const ctx = usePageContext();
  const [collapsed, setCollapsed] = useState(false);
  const firstInstall = !isInstalled();

  const username = ctx?.username ?? null;

  return (
    <div className="r3-host">
      <div className="r3-panel">
        <PanelHeader
          username={username}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />

        {!collapsed && (
          <div className="r3-body">
            {firstInstall && <WelcomeState />}

            {!firstInstall && (!ctx || ctx.pageType === 'other') && (
              <MinimalState />
            )}

            {!firstInstall && ctx && ctx.pageType === 'profile' && (
              <ProfileState username={username} />
            )}

            {!firstInstall && ctx && ctx.subreddit && ctx.pageType !== 'profile' && (
              <FullPanel ctx={ctx} />
            )}
          </div>
        )}

        <PanelFooter />
      </div>
    </div>
  );
}

function WelcomeState() {
  return (
    <div className="r3-welcome">
      <div className="r3-welcome__title">Welcome to R3</div>
      <div className="r3-welcome__body">
        Navigate to a subreddit to see its rules, check your posting risk,
        and track whether your posts stay visible.
      </div>
    </div>
  );
}

function MinimalState() {
  return (
    <div className="r3-minimal">No subreddit detected on this page.</div>
  );
}

function ProfileState({ username }: { username: string | null }) {
  return (
    <div className="r3-minimal">
      Viewing profile{username ? ` of ${username}` : ''}.
    </div>
  );
}

function FullPanel({ ctx }: { ctx: NonNullable<ReturnType<typeof usePageContext>> }) {
  const { username, subreddit, pageType, postId } = ctx;

  if (!subreddit) return <MinimalState />;

  if (pageType === 'submit') {
    return (
      <>
        <RiskCard subreddit={subreddit} username={username} />
        <RulesBlock subreddit={subreddit} />
        <StatusCard postId={postId} username={username} />
        <NotesBlock username={username} subreddit={subreddit} />
      </>
    );
  }

  return (
    <>
      <RulesBlock subreddit={subreddit} />
      <RiskCard subreddit={subreddit} username={username} />
      <StatusCard postId={postId} username={username} />
      <NotesBlock username={username} subreddit={subreddit} />
    </>
  );
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/components/FloatingPanel.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/panel/components/FloatingPanel.tsx tests/components/FloatingPanel.test.tsx
git commit -m "feat: FloatingPanel — collapse, pageType layouts, first-install welcome"
```

---

## Task 20: Background Service Worker

**Files:**
- Create: `src/background/index.ts`

- [ ] **Step 1: Create `src/background/index.ts`**

```ts
// Phase 1: lifecycle stub only.
// Phase 2 will add API proxy calls for rules scraping, risk scoring, visibility checks.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[R3] Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[R3] Browser started');
});
```

- [ ] **Step 2: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: background service worker stub — lifecycle events only"
```

---

## Task 21: Options Page

**Files:**
- Create: `src/options/options.html`
- Create: `src/options/options.tsx`

- [ ] **Step 1: Create `src/options/options.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>R3 Settings</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f6f7f8; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./options.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/options/options.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { getPrefs, setPrefs, clearAllData, clearLogs } from '../panel/storage';
import type { UserPrefs } from '../shared/types';

const GUEST_USERNAME = 'guest';

function OptionsApp() {
  const [prefs, setPrefsState] = useState<UserPrefs>({
    enabled: true,
    collapsedByDefault: false,
    guestMode: false,
  });
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    setPrefsState(getPrefs(GUEST_USERNAME));
  }, []);

  function updatePref<K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) {
    const updated = { ...prefs, [key]: value };
    setPrefsState(updated);
    setPrefs(GUEST_USERNAME, updated);
  }

  function handleClearData() {
    clearAllData();
    clearLogs();
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  }

  return (
    <div style={{ maxWidth: 480, margin: '48px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 32, color: '#1a1a1b' }}>
        R3 Settings
      </h1>

      <section style={{ background: '#fff', borderRadius: 8, border: '1px solid #edeff1', padding: 24, marginBottom: 24 }}>
        <ToggleSetting
          label="Extension enabled"
          description="Show the R3 panel on Reddit"
          value={prefs.enabled}
          onChange={(v) => updatePref('enabled', v)}
        />
        <ToggleSetting
          label="Collapsed by default"
          description="Start the panel in collapsed state"
          value={prefs.collapsedByDefault}
          onChange={(v) => updatePref('collapsedByDefault', v)}
        />
        <ToggleSetting
          label="Guest mode"
          description="Ignore detected Reddit username"
          value={prefs.guestMode}
          onChange={(v) => updatePref('guestMode', v)}
        />
      </section>

      <section style={{ background: '#fff', borderRadius: 8, border: '1px solid #edeff1', padding: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Clear cached data</div>
        <div style={{ fontSize: 13, color: '#7c7c7c', marginBottom: 16 }}>
          Removes all cached subreddit rules, notes, and logs stored by R3.
        </div>
        <button
          onClick={handleClearData}
          style={{
            padding: '8px 20px',
            background: cleared ? '#4caf50' : '#cc3300',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {cleared ? 'Cleared!' : 'Clear all data'}
        </button>
      </section>
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#7c7c7c' }}>{description}</div>
      </div>
      <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background: value ? '#ff4500' : '#ccc',
            borderRadius: 12,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        />
        <span
          style={{
            position: 'absolute',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            top: 3,
            left: value ? 23 : 3,
            transition: 'left 0.2s',
          }}
        />
      </label>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<OptionsApp />);
```

- [ ] **Step 3: Commit**

```bash
git add src/options/options.html src/options/options.tsx
git commit -m "feat: options page — enable toggle, collapse default, guest mode, clear cache"
```

---

## Task 22: Final Build Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS. Note test count and any failures.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Build the extension**

```bash
npm run build
```

Expected: `dist/` directory created with `manifest.json`, content script bundle, background bundle, options page.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: R3 Phase 1 complete — extension builds and all tests pass"
```

---

## Spec Coverage Check

| Spec section | Covered by task(s) |
|---|---|
| Shadow DOM + React mount | Task 11 |
| SPA navigation watcher (300ms debounce) | Task 6 |
| DOM detector → PageContext | Task 5 |
| Bridge (in-process pub/sub) | Task 7 |
| Mount guard (`__R3_PANEL_MOUNTED__`) | Task 8 |
| Rules fetch (stale-while-revalidate, dedup, rate-limit, retry) | Task 9 |
| Rules cache (TTL 24h, LRU 100 subs) | Task 4 |
| All 5 RulesBlock states | Task 14 |
| RiskCard mocked + Pro lock | Task 15 |
| StatusCard mocked + Pro lock | Task 16 |
| NotesBlock (debounced, 4096 cap, guest key) | Task 17 |
| PanelHeader (username / Guest, collapse) | Task 13 |
| FloatingPanel (pageType layouts, first-install) | Task 19 |
| PanelFooter → options | Task 18 |
| Render guard (subreddit/pageType only) | Task 12 |
| Structured logging (rolling 500) | Task 3 |
| Storage versioned keys (v1:) | Task 4 |
| Options page (4 settings + clear cache) | Task 21 |
| Background service worker stub | Task 20 |
| MV3 manifest (Chrome/Edge primary) | Task 1 |
| TypeScript throughout | Task 1 (tsconfig) |
| Vitest unit + RTL component tests | Tasks 4–19 |
