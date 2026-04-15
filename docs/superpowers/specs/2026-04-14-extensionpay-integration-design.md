# ExtensionPay Integration Design
Date: 2026-04-14
Status: Approved (v2 — post Opus review)

## Overview

Wire ExtensionPay (Stripe-backed) into R3 to gate Pro features behind a $5 one-time founder license. Backend validates licenses server-side via ExtensionPay API; extension handles purchase flow and caches paid state locally. CSS blur is UX only — real gate is always server-side.

## Pricing Model

| Phase | Model | Price | Limit |
|---|---|---|---|
| Launch (now) | Lifetime founder | $5 one-time | First 200–300 users |
| After traction | Subscription | $3.99/mo or $29/yr | Ongoing |

Founders grandfathered via ExtensionPay plan IDs — lifetime plan ID remains valid when subscription plan launches. No special migration needed client-side.

## Architecture (Approach B)

### Identity
- ExtensionPay assigns an opaque `api_key` per install
- Extension sends raw `api_key` over TLS in `Authorization: Bearer <api_key>` header
- No hashing — hashing is security theater since backend needs the raw key to call ExtensionPay API
- Backend never stores user email — no PII surface

### Purchase Flow
```
User clicks "Unlock Pro" footer CTA
→ extpay.openPaymentPage() opens ExtensionPay hosted checkout
→ Stripe processes $5 payment
→ ExtensionPay marks user paid
→ extpay.onPaid fires in service worker (registered at SW top-level)
→ SW writes { paid: true } to chrome.storage.local
→ SW sends message to all panels: { type: 'LICENSE_UPDATED', paid: true }
→ Panel re-renders: cards fade in, toast "Pro unlocked"
```

### Pro API Call Flow
```
Panel reads paid from chrome.storage.local (instant render, no flicker)
→ Sends request to /api/v1/risk or /api/v1/post-status
  with Authorization: Bearer <api_key>
→ Backend LicenseMiddleware:
  → cache hit paid=true: serve data
  → cache miss: GET https://extensionpay.com/api/v1/users/{api_key}
    → paid=true: cache 15min TTL, serve data
    → paid=false or missing header: return 403 immediately (no cache)
```

### Cache TTLs
| Result | TTL | Reason |
|---|---|---|
| paid=true | 15 minutes | Balances refund propagation vs. ExtensionPay API load |
| paid=false | Not cached | New paying user must not see 60s of 403s after payment |
| Offline grace | 24hr (paid=true only) | chrome.storage.local fallback — never grant grace to unpaid |

## Backend Changes

### Remove
- `/api/v1/license` stub endpoint (replaced by inline middleware)

### Add
- `LicenseMiddleware` applied to `/api/v1/risk` and `/api/v1/post-status`
  - Reads `Authorization: Bearer <api_key>` header
  - Missing/empty header → 403 immediately
  - Checks in-memory TTL cache keyed on `api_key`
  - Cache miss → `GET https://extensionpay.com/api/v1/users/{api_key}` with `EXTENSIONPAY_SECRET_KEY`
  - paid=true → cache 15min, allow request
  - paid=false → 403, not cached
  - ExtensionPay API down → fail open with 503 (don't penalise paying users for upstream outage)

### Environment Variables
- `EXTENSIONPAY_SECRET_KEY` — ExtensionPay account secret key (never committed)

### Revocation / Refunds
- No webhook support from ExtensionPay at this stage
- Accepted limitation: revoked licenses propagate within 15min (next cache miss)
- Document in ops runbook — manual revocation if needed via ExtensionPay dashboard

## Extension Changes

### Service Worker (`background/index.ts`)
- Add `extpay.startBackground()` at **top level** of SW script (not inside any event handler)
- Register `extpay.onPaid(callback)` at **top level** — SW can cold-start at any time, must re-register on every wake
- On paid event: `chrome.storage.local.set({ paid: true })`, broadcast `LICENSE_UPDATED` to all panels
- `onStartup` + `onInstalled` hooks retained for completeness but SW top-level registration is the critical path

### LicenseContext (`panel/contexts/LicenseContext.tsx`)
- React context providing `{ paid: boolean, apiKey: string, openPaymentPage: () => void }`
- On mount: read `chrome.storage.local` synchronously for instant render
- Listen for `LICENSE_UPDATED` SW messages → update `paid` state without reload
- `apiKey` retrieved via `extpay.getUser()` and passed as Bearer token in all Pro API calls
- Offline grace: if `paid=true` in storage and network unavailable, treat as paid (24hr max)

### RiskCard (`panel/components/RiskCard.tsx`)
| Tier | Visible | Locked (UX blur only — real gate is server) |
|---|---|---|
| Free | Real risk score: "Account Risk: HIGH (78)" | Karma ratio, account age, shadowban check — blurred + lock icon |
| Pro | Full breakdown | — |

### StatusCard (`panel/components/StatusCard.tsx`)
| Tier | Visible | Locked (UX blur only — real gate is server) |
|---|---|---|
| Free | "Last 5 posts: 1 removed" (count only, fetched free) | Which post, why, when — blurred + lock icon |
| Pro | Full removal history + details | — |

Note: blur is CSS — motivated users can inspect element. This is acceptable. The actual Pro data never reaches the extension for free users — server returns 403. Blur is UX, not security.

### Upgrade CTA
- Single "Unlock Pro — $5 one-time" bar pinned to panel footer
- Subtext: "No account. No subscription. Pay once."
- Lock icons on blurred fields are clickable — focus/scroll to footer CTA
- No per-card upgrade buttons

### Post-Payment UX
- Cards fade in with CSS transition (no reload, no flicker)
- Toast: "Pro unlocked"
- `chrome.storage.local` updated immediately → next Reddit page load renders Pro instantly

## Testing

### Extension
- `LicenseContext`: paid/unpaid state from storage, SW message updates, offline grace (paid=true only)
- `RiskCard`: free tier (score visible, breakdown blurred), Pro tier (full data rendered)
- `StatusCard`: free tier (count visible, breakdown blurred), Pro tier (full breakdown)
- SW registration: mock `extpay.onPaid`, verify `chrome.storage.local` written and panel messaged
- Payment flow: mock `extpay.openPaymentPage()`, verify state transition

### Backend
- Middleware: valid Bearer → serves data; missing header → 403; paid=false → 403
- Cache: paid=true cached 15min; paid=false not cached; second request within TTL hits cache not ExtensionPay
- ExtensionPay down: middleware returns 503, not 403
- Mock ExtensionPay API in all backend tests

## Out of Scope
- Subscription billing (after traction — separate design)
- User accounts / cross-device sync
- Refund UI (ExtensionPay dashboard handles this)
- Analytics / conversion tracking
- Webhook-based license revocation (no ExtensionPay support at this stage)
