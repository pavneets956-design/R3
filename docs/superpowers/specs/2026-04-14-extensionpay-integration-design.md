# ExtensionPay Integration Design
Date: 2026-04-14
Status: Approved

## Overview

Wire ExtensionPay (Stripe-backed) into R3 to gate Pro features behind a $5 one-time founder license. Backend validates licenses server-side; extension handles purchase flow and caches paid state locally.

## Pricing Model

| Phase | Model | Price | Limit |
|---|---|---|---|
| Launch (now) | Lifetime founder | $5 one-time | First 200–300 users |
| After traction | Subscription | $3.99/mo or $29/yr | Ongoing |

Founder users grandfathered into lifetime access when subscription launches.

## Architecture (Approach B)

### Identity
- ExtensionPay assigns an opaque `api_key` per install (no email involved)
- Extension hashes `api_key` and sends `Authorization: Bearer <hash>` with every Pro API request
- Backend never stores or sees user email — no PII surface

### Purchase Flow
```
User clicks "Unlock Pro" footer CTA
→ extpay.openPaymentPage() opens ExtensionPay hosted checkout
→ Stripe processes $5 payment
→ ExtensionPay marks user paid
→ extpay.onPaid fires in service worker
→ SW writes paid=true to chrome.storage.local
→ SW sends message to panel: { type: 'LICENSE_UPDATED', paid: true }
→ Panel re-renders: cards un-blur with fade, toast "Pro unlocked"
```

### Pro API Call Flow
```
Panel reads paid from chrome.storage.local (instant render)
→ Sends request to /api/v1/risk or /api/v1/post-status
  with Authorization: Bearer <hash(api_key)>
→ Backend middleware: check license cache
  → cache hit + paid=true: serve data
  → cache miss: call ExtensionPay GET /api/v1/users/{api_key}
    → paid=true: cache 15min, serve data
    → paid=false: cache 60s, return 403
```

### Cache TTLs
| Result | TTL | Reason |
|---|---|---|
| paid=true | 15 minutes | Balances refund propagation vs. API load |
| paid=false | 60 seconds | Reduce ExtensionPay calls for free users |
| Offline grace | 24 hours hard cap | chrome.storage.local fallback |

## Backend Changes

### Remove
- `/api/v1/license` stub endpoint (no longer needed)

### Add
- `LicenseMiddleware` on `/api/v1/risk` and `/api/v1/post-status`
  - Reads `Authorization: Bearer <hash>` header
  - Checks in-memory TTL cache (existing cache infrastructure)
  - On miss: calls `GET https://extensionpay.com/api/v1/users/{api_key}` with secret key
  - Returns 403 `{"detail": "Pro license required"}` if unpaid

### Environment Variables
- `EXTENSIONPAY_SECRET_KEY` — ExtensionPay account secret key

## Extension Changes

### Service Worker (`background/index.ts`)
- Add `extpay.startBackground()` on init
- Register `extpay.onPaid(user => { ... })` — re-register on `chrome.runtime.onStartup` and `onInstalled`
- On paid: write `chrome.storage.local.set({ paid: true })`, send message to all panels

### LicenseContext (`panel/contexts/LicenseContext.tsx`)
- React context providing `{ paid: boolean, openPaymentPage: () => void }`
- On mount: read `chrome.storage.local` for instant render (no flicker)
- Listen for SW messages `LICENSE_UPDATED` to re-render without reload
- Provide `hash(api_key)` for API request headers (via `extpay.getUser()`)

### RiskCard (`panel/components/RiskCard.tsx`)
| Tier | Visible | Locked |
|---|---|---|
| Free | Real risk score: "Account Risk: HIGH (78)" | Karma ratio, account age, shadowban check (blurred + lock icon) |
| Pro | Full breakdown | — |

### StatusCard (`panel/components/StatusCard.tsx`)
| Tier | Visible | Locked |
|---|---|---|
| Free | "Last 5 posts: 1 removed" (count only) | Which post, why, when (blurred + lock icon) |
| Pro | Full removal history + details | — |

### Upgrade CTA
- Single "Unlock Pro — $5 one-time" bar pinned to panel footer
- Subtext: "No account. No subscription. Pay once."
- Lock icons on each blurred field are clickable (scroll/focus footer CTA)
- No multiple upgrade buttons — one persistent CTA only

### Post-Payment UX
- Cards un-blur with CSS fade transition (not reload)
- Toast notification: "Pro unlocked"
- `chrome.storage.local` updated so next Reddit page load renders Pro instantly

## Testing

### Extension
- `LicenseContext` tests: paid/unpaid states, SW message handling, storage read on mount
- `RiskCard` tests: free view (score visible, breakdown blurred), Pro view (full data)
- `StatusCard` tests: free view (count), Pro view (full breakdown)
- Payment flow: mock `extpay.openPaymentPage()` and `extpay.onPaid`

### Backend
- Middleware tests: valid bearer → serves data, invalid/missing → 403
- Cache tests: paid TTL=15min, unpaid TTL=60s
- ExtensionPay mock: test paid=true and paid=false responses

## Out of Scope
- Subscription billing (Phase 2 of monetization — after traction)
- User accounts or cross-device sync
- Refund flow UI (ExtensionPay handles this)
- Analytics/conversion tracking
