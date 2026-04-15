# R3 — Reddit Rules & Requirements Browser Extension
## Phase 1 Design Spec
**Date:** 2026-04-14
**Status:** Approved

---

## 1. Problem Statement

Reddit removes content from posts without notifying users in 69% of cases. New users encounter hidden entry barriers (karma thresholds, account age requirements) that are not stated in subreddit rules. There is no tool that warns users before they post, or confirms whether their post was silently removed after.

R3 is a browser extension that surfaces this information directly inside the Reddit interface — before the post is submitted and after it is sent.

---

## 2. Phase 1 Scope

Phase 1 is a local-first MVP. No backend, no payments, no Reddit OAuth. The goal is a working extension that demonstrates the full user experience with mocked data where backend intelligence is not yet available.

**In scope:**
- Browser extension injecting a floating panel into New Reddit
- Subreddit rules display (real data via public Reddit JSON endpoint)
- Posting risk card (mocked data, Pro lock overlay)
- Visibility / removal status card (mocked data, Pro lock overlay)
- Per-subreddit notes (persisted locally)
- Username detection from page DOM, guest mode fallback
- Options / settings page
- Structured local logging
- Vitest unit tests + React Testing Library component tests

**Out of scope for Phase 1:**
- PRAW scraping or backend API
- Reddit OAuth or account system
- Stripe or payment flow
- Landing page
- Old Reddit support
- Cross-device sync

---

## 3. Browser Targets

| Browser | Support Level |
|---|---|
| Chrome | Primary — fully supported, MV3 |
| Edge | Primary — fully supported, MV3 (Chromium-based) |
| Firefox | Compatibility-tested — MV3 supported but extension behavior may vary; treat as secondary validation target, not assumed identical to Chrome |

All three browsers are targeted from a single WebExtensions MV3 codebase.

---

## 4. Tech Stack

| Concern | Choice |
|---|---|
| UI framework | React 18 |
| Build tool | Vite |
| Language | TypeScript throughout |
| Styling | CSS Modules scoped within Shadow DOM |
| Tests | Vitest (unit), React Testing Library (components) |
| State management | React useState / useEffect — no Redux or global store |

---

## 5. Architecture

### 5.1 Layers

```
┌─────────────────────────────────────────────┐
│  Browser (Reddit tab)                        │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Content Script                      │   │
│  │  ├── watcher.ts   (SPA nav)          │   │
│  │  ├── detector.ts  (DOM → context)    │   │
│  │  └── bridge.ts    (typed messaging)  │   │
│  └──────────────┬───────────────────────┘   │
│                 │ mounts                     │
│  ┌──────────────▼───────────────────────┐   │
│  │  Shadow DOM Host (document.body)     │   │
│  │  └── Shadow Root (open)              │   │
│  │       └── React App                  │   │
│  │            └── FloatingPanel + tree  │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Background Service Worker           │   │
│  │  (lifecycle stub, future API calls)  │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  localStorage                        │   │
│  │  (versioned, scoped by feature)      │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 5.2 Key architectural rules

- **Content script is the sensor, not the renderer.** It reads the DOM and produces a `PageContext` object. It does not build UI.
- **React app is the renderer, not the sensor.** It receives context via the bridge and renders the panel.
- **Shadow DOM is the boundary.** No CSS crosses it in either direction. Reddit's aggressive global styles cannot bleed into the panel.
- **Panel mount is idempotent.** Calling mount twice must not create two panels. A mount guard flag (`window.__R3_PANEL_MOUNTED__`) prevents duplication.
- **All backend interfaces are stubbed.** An `apiClient.ts` module exists with typed interfaces. All calls return mocked data in Phase 1. This is the plug point for Phase 2.

### 5.3 SPA navigation

Reddit is a React SPA. Navigation does not trigger a page reload. The content script uses a `MutationObserver` watching for URL changes, debounced at 300ms. On each navigation event:

1. `watcher.ts` detects the URL change
2. `detector.ts` reads the DOM and builds a new `PageContext`
3. `bridge.ts` sends the updated context to the React app
4. React app re-renders with the new context

The observer is disconnected and re-connected cleanly on each navigation to prevent memory leaks. If re-injection fails, the panel re-mounts from scratch.

---

## 6. PageContext Model

This typed object is the contract between the content script and the React app. It is the single source of truth for everything the panel needs to know about the current Reddit page.

```ts
interface PageContext {
  username: string | null;      // detected from DOM; null means guest mode
  subreddit: string | null;     // e.g. "javascript"; null if not on a subreddit page
  pageType: 'feed' | 'post' | 'submit' | 'profile' | 'other';
  postComposerOpen: boolean;
  postId: string | null;        // present on post pages
  url: string;
  detectedAt: number;           // Unix timestamp ms
}
```

**Detection strategy:** Prefer `data-testid` attributes and `role` attributes over class names. Reddit uses dynamic/hashed class names that change without notice. Never hard-code a class-based selector.

If detection fails for any field, that field returns `null` or a safe default. The panel renders in a degraded-but-functional state rather than erroring out.

---

## 7. Component Tree

```
FloatingPanel
├── PanelHeader
│   ├── R3 logo / title
│   ├── Username badge (or "Guest")
│   └── Collapse / close toggle
├── RulesBlock
│   ├── Subreddit name heading
│   ├── Rules list (from public Reddit JSON, cached 24h)
│   └── States: loading / loaded / error / empty / stale
├── RiskCard
│   ├── Risk score badge (mocked: Low / Medium / High)
│   ├── Risk factors list (mocked placeholder items)
│   └── Pro lock overlay (passive — no payment flow)
├── StatusCard
│   ├── Visibility status indicator (mocked)
│   ├── Last checked timestamp
│   └── Pro lock overlay (passive — no payment flow)
├── NotesBlock
│   ├── Textarea (debounced write to storage, 300ms)
│   ├── Character count
│   └── Max length: 4096 chars
└── PanelFooter
    └── Link to options page
```

### Panel adapts by page type

| pageType | Panel behaviour |
|---|---|
| `feed` | Full panel — rules, risk card, status card, notes |
| `post` | Full panel with postId available to StatusCard |
| `submit` | Composer mode — RiskCard promoted, rules shown prominently |
| `profile` | Minimal — username info only, no subreddit features |
| `other` | Minimal "no subreddit detected" state |

### First-install experience

On first load, if `v1:meta:installed` is not set in storage, the panel shows a brief "Welcome to R3" state explaining the three core panels before any subreddit is detected. This prevents the blank "what is this?" confusion that causes immediate uninstalls.

### Pro lock overlays

`RiskCard` and `StatusCard` show a passive locked state in Phase 1:
- A "Pro" badge
- One-line value statement ("Unlock to see your real risk score")
- A "Coming soon" CTA — no payment UI, no fake flow

---

## 8. Storage Schema

All keys are versioned. The version prefix (`v1:`) allows future migrations without breaking existing installs.

### Key shapes

| Key | Scope | TTL | Cap |
|---|---|---|---|
| `v1:subreddit:{name}:rules:data` | Subreddit | 24h | 100 subreddits (LRU) |
| `v1:subreddit:{name}:rules:fetchedAt` | Subreddit | — | — |
| `v1:user:{username}:subreddit:{name}:notes` | User + subreddit | None | 4096 chars |
| `v1:user:{username}:prefs` | User | None | — |
| `v1:meta:installed` | Global | None | — |
| `v1:logs` | Global | None | Rolling 500 entries max |

**Guest mode:** When no username is detected, `{username}` is replaced with the literal string `guest`.

### Rules cache eviction

The rules cache holds a maximum of 100 subreddits. When the 101st subreddit is cached, the least-recently-used entry is evicted. An index key `v1:subreddit:_lru` maintains insertion order.

### Storage versioning

If a future release changes the storage schema, a migration runs once on extension startup. Old `v1:` keys are migrated or cleared before the new version writes any data.

---

## 9. Rules Fetch

Reddit exposes a public, unauthenticated endpoint for subreddit rules:

```
GET https://www.reddit.com/r/{subreddit}/about/rules.json
```

This is the only real network call in Phase 1.

**Cache strategy:** Stale-while-revalidate. If cached data exists but is older than 24h, the panel renders the stale rules immediately and triggers a background re-fetch. The panel updates when the fresh data arrives.

**Retry strategy:** On fetch failure, one automatic silent retry fires after 1.5 seconds. If the retry also fails, the error UI is shown with a manual retry button.

**Failure handling:**

| Scenario | Behaviour |
|---|---|
| Network / CORS error | 1 auto-retry → "Couldn't load rules" + retry button |
| HTTP 404 / subreddit not found | "Rules unavailable for this subreddit" |
| Private / quarantined subreddit | "This subreddit is private — rules unavailable" |
| Malformed / unexpected JSON | Log error event → show "Couldn't load rules" |
| Stale cache (TTL expired) | Show stale rules → background re-fetch → update on success |

---

## 10. Error Handling Principles

**Per-component fault isolation.** Each component is wrapped in an error boundary. A failure in `RulesBlock` does not unmount `NotesBlock`. The panel always renders something.

**Silent fallbacks, never blocking errors.** Username detection failing → guest mode (no error shown). PageContext detection failing → minimal panel mode (no error shown). Only surface errors when they directly affect a feature the user is actively using.

**Mount guard.** The content script sets `window.__R3_PANEL_MOUNTED__ = true` before mounting. It checks this flag before every mount attempt. Duplicate panels are impossible.

---

## 11. Structured Logging

All significant events are logged to `v1:logs` in localStorage using a consistent shape:

```ts
interface LogEvent {
  type: string;           // e.g. "RULES_FETCH_ERROR", "PANEL_MOUNTED", "USERNAME_DETECTED"
  subreddit?: string;
  username?: string;
  errorType?: string;
  message?: string;
  timestamp: number;      // Unix ms
}
```

The log is a rolling array capped at 500 entries. When the cap is reached, the oldest entry is dropped. Logs are viewable from the options page in Phase 2.

---

## 12. Options Page

A separate extension page (`options.html`) accessible from `PanelFooter` and the browser's extension management UI.

| Setting | Type | Default |
|---|---|---|
| Extension enabled | Toggle | On |
| Panel collapsed by default | Toggle | Off |
| Guest mode (ignore detected username) | Toggle | Off |
| Clear all cached data | Button | — |

Disabling the extension via the options page causes the content script to unmount the panel immediately and stop the MutationObserver on the next navigation.

---

## 13. File Structure

```
project-root/
├── manifest.json               # MV3 manifest (at project root)
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── content/
│   │   ├── index.ts            # Entry point — wires watcher + detector + bridge
│   │   ├── watcher.ts          # MutationObserver, URL change detection, debounce
│   │   ├── detector.ts         # DOM reading → PageContext
│   │   └── bridge.ts           # Typed message passing to React app
│   ├── panel/
│   │   ├── main.tsx            # Shadow DOM mount, React root
│   │   ├── components/
│   │   │   ├── FloatingPanel.tsx
│   │   │   ├── PanelHeader.tsx
│   │   │   ├── RulesBlock.tsx
│   │   │   ├── RiskCard.tsx
│   │   │   ├── StatusCard.tsx
│   │   │   ├── NotesBlock.tsx
│   │   │   └── PanelFooter.tsx
│   │   ├── hooks/
│   │   │   └── usePageContext.ts
│   │   ├── api/
│   │   │   └── apiClient.ts    # Stubbed — all calls return mocked data in Phase 1
│   │   └── storage.ts          # Composite key helpers, TTL logic, LRU eviction
│   ├── background/
│   │   └── index.ts            # Service worker stub
│   ├── options/
│   │   ├── options.html
│   │   └── options.tsx
│   └── shared/
│       ├── types.ts            # PageContext, LogEvent, shared interfaces
│       └── logger.ts           # logEvent() helper
├── tests/
│   ├── unit/
│   │   ├── detector.test.ts
│   │   ├── storage.test.ts
│   │   └── watcher.test.ts
│   └── components/
│       ├── RulesBlock.test.tsx
│       ├── RiskCard.test.tsx
│       ├── StatusCard.test.tsx
│       ├── NotesBlock.test.tsx
│       ├── FloatingPanel.test.tsx
│       └── PanelHeader.test.tsx
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-04-14-r3-extension-design.md
```

---

## 14. Testing Strategy

### Unit tests (Vitest)

| Module | What to test |
|---|---|
| `detector.ts` | Correct `PageContext` produced from mocked DOM for each `pageType` |
| `storage.ts` | Key construction, TTL hit/miss, LRU eviction at 100-sub cap, versioned keys |
| `watcher.ts` | Debounce behaviour; callback fires once per URL change, not per DOM mutation |
| Rules fetch | Each failure scenario returns correct fallback state; retry fires once |

### Component tests (React Testing Library)

| Component | States to test |
|---|---|
| `RulesBlock` | Loading, loaded, error, empty, stale-while-revalidating |
| `RiskCard` | Mocked data renders; Pro lock overlay present |
| `StatusCard` | Mocked data renders; Pro lock overlay present |
| `NotesBlock` | Input persists to storage (debounced); loads existing notes on mount; 4096 char cap enforced |
| `FloatingPanel` | Collapses/expands; correct layout per `pageType` |
| `PanelHeader` | Shows detected username; shows "Guest" when username is null |

### Manual test checklist

- [ ] Install unpacked in Chrome — panel appears on reddit.com
- [ ] Install unpacked in Firefox — panel appears, note any behaviour differences
- [ ] Install unpacked in Edge — panel appears on reddit.com
- [ ] Navigate between subreddits — panel updates without page reload
- [ ] Open post composer — panel switches to submit context, RiskCard promoted
- [ ] Navigate to a private/quarantined subreddit — rules show correct error state
- [ ] Navigate to a non-subreddit page — panel renders minimal mode
- [ ] Open a new tab on a non-Reddit site — extension does not inject
- [ ] Disable extension in options — panel unmounts immediately
- [ ] Clear cache in options — next subreddit load re-fetches rules
- [ ] First install experience — "Welcome to R3" state appears correctly
- [ ] 100-subreddit LRU cap — oldest entry evicted when 101st is cached

---

## 15. Phase 2 Hooks

These are not built in Phase 1 but the architecture explicitly leaves room for them:

- `apiClient.ts` — swap stubs for real backend calls (PRAW scraper, karma predictor)
- `RiskCard` Pro unlock — connect to Stripe payment flow
- `StatusCard` Pro unlock — connect to shadowban monitor backend
- `v1:logs` — surface log viewer in options page
- Firefox-specific compatibility shims — add if manual testing reveals gaps
