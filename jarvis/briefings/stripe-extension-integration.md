# Stripe Integration Research — R3 Browser Extension
**Task:** R010
**Agent:** jarvis-research
**Date:** 2026-04-14
**Status:** complete
**Depends on:** R003 (monetization research — complete)

Not legal or financial advice. Verify all CWS policy items against current developer.chrome.com policy docs before acting.

---

## 1. Summary

Stripe Checkout can be used in a Chrome extension without violating Chrome Web Store policies. The correct pattern is a browser-tab redirect: the extension opens a new tab to a hosted checkout page, payment completes there, and the extension checks license status via an API call or local storage flag. Multiple production implementations of this pattern exist in 2026.

For R3's Phase 2 launch, the recommended path is ExtensionPay (wraps Stripe) to avoid running a backend before revenue justifies the cost. Switch to raw Stripe once the PRAW backend is running anyway.

---

## 2. Chrome Web Store Policy on Payments

**Key rule:** Extensions must not process payments inside the extension popup, side panel, or content script. Payment UI must live on an external, hosted page.

This is not a prohibition on Stripe — it's a prohibition on embedding payment forms inside the extension. Stripe Checkout (hosted) is explicitly compliant because:
- User is redirected to stripe.com or your hosted page (not inside the extension)
- No payment card data ever enters the extension's context
- PCI compliance is maintained on Stripe's servers

Reference: [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies)

---

## 3. Standard Extension Payment Flow (Stripe Checkout)

```
User clicks "Upgrade to Pro" in extension popup
    → extension calls chrome.tabs.create({ url: YOUR_CHECKOUT_URL })
    → new tab opens with Stripe Checkout or your hosted checkout page
    → user completes payment
    → Stripe fires webhook to YOUR backend
    → backend records license/subscription status
    → extension checks status on next open (via your API or via ExtensionPay's API)
    → Pro features unlocked
```

This pattern is:
- Chrome Web Store compliant
- PCI compliant
- Used by multiple extensions in production

---

## 4. Option A: ExtensionPay (recommended for Phase 2 launch)

### How it works

ExtensionPay is a purpose-built payment service for browser extensions backed by Stripe. It handles the hosted checkout page, license management, and provides a simple JS client library for the extension.

**Integration in R3:**
1. Sign up at extensionpay.com, configure your product and pricing
2. Add their small JS library to the extension
3. Call `extpay.openPaymentPage()` when user clicks Upgrade — this opens a tab to ExtensionPay's hosted checkout
4. Call `extpay.getUser()` to check paid status — returns `{ paid: true/false }`
5. Gate Pro features behind `user.paid`

**No backend required.** License state is stored in `chrome.storage.sync` and validated against ExtensionPay's servers.

**Pricing:**
- ExtensionPay fee: ~5% per transaction [UNVERIFIED — verify at extensionpay.com before signing up]
- Stripe fee: ~2.9% + $0.30 per transaction
- Total: ~8% + $0.30 [UNVERIFIED]
- No monthly fee, no upfront cost

**Supports:**
- One-time purchase
- Monthly subscription
- Annual subscription
- Free trials
- Freemium (free users + paid users)

**Source:** [extensionpay.com](https://extensionpay.com/) | [ExtensionPay + Stripe article](https://extensionpay.com/articles/add-stripe-payments-to-chrome-extensions)

### Why this fits R3 Phase 2 launch

The PRAW backend for Phase 2 will take time to build. R3 should not run a payments backend before the Pro features are live. ExtensionPay defers that infrastructure cost until the PRAW service is already running.

---

## 5. Option B: Stripe Direct (recommended when PRAW backend is live)

### Architecture

Once R3 has a backend service running (the PRAW scraper), add Stripe integration to it:

1. Backend creates a Stripe Checkout session when user wants to upgrade
2. Extension opens the checkout URL in a new tab: `chrome.tabs.create({ url: checkoutUrl })`
3. User pays, Stripe sends webhook to backend
4. Backend stores subscription status in a database
5. Extension calls your backend's license endpoint on startup to check status
6. Gate Pro features behind license check

**Implementation cost:** 1–2 days of backend work assuming you already have a running server.

**Fees:** Stripe standard rate: 2.9% + $0.30 per transaction (no additional ExtensionPay cut).

### Alternative to a database: Dodo Payments

Dodo Payments is a Merchant of Record that provides a public license validation endpoint. You can call it directly from the extension without a secret key — this allows license validation without a backend database.

Source: [Dodo Payments — Chrome extension monetization](https://dodopayments.com/blogs/monetize-chrome-extension)

---

## 6. Option C: BillingExtensions

A newer service (2025–2026) similar to ExtensionPay but with server-side entitlement checks. Claimed to work without a backend via their hosted API.

- [billingextensions.com](https://billingextensions.com/)
- Supports subscriptions + one-time purchases for Chrome/Edge
- Server-side entitlement validation (harder to bypass than client-side)

No pricing data available [UNVERIFIED — check their site].

---

## 7. License Validation Approaches

### Client-side (ExtensionPay default)

ExtensionPay stores a `paid` flag in `chrome.storage.sync`. The flag is set by their library after verifying with their server. This is moderately tamper-resistant — a technical user could manually set the flag in DevTools, but most users won't.

For a niche power-user extension like R3, this is acceptable for Phase 2 launch.

### Server-side (Stripe direct)

The extension calls your backend on startup, backend checks Stripe subscription status, returns a signed token or yes/no. More tamper-resistant, requires a running backend.

Implement this when the PRAW backend exists — add a `/api/license` endpoint to the same service.

---

## 8. One-Time Purchase vs. Subscription Decision

| | One-time ($9.99) | Subscription ($3.99/month) |
|---|---|---|
| User friction | Low | Medium |
| Revenue predictability | Low | High |
| Suitable when... | Validating demand | PRAW backend has ongoing cost |
| Best for R3 | Phase 2 launch | Phase 3+ (once backend proven) |

Start with one-time, add subscription option later. This is the standard extension playbook [UNVERIFIED as a universal rule — based on developer community recommendations].

---

## 9. Recommended Implementation Sequence for R3

**Phase 2 (PRAW backend ships):**
1. Sign up for ExtensionPay, configure $9.99 one-time Pro license
2. Add `extpay` npm package to extension
3. Wire Upgrade button to `extpay.openPaymentPage()`
4. Gate RiskCard and StatusCard behind `extpay.getUser().paid`
5. Test with Stripe test mode before going live

**Phase 3 (when revenue justifies):**
1. Migrate to Stripe direct, drop ExtensionPay
2. Add `/api/license` endpoint to the PRAW backend
3. Add subscription pricing ($3.99/month or $29.99/year)

---

## Sources

- [ExtensionPay — Stripe payments for browser extensions](https://extensionpay.com/)
- [ExtensionPay: add Stripe to Chrome extensions](https://extensionpay.com/articles/add-stripe-payments-to-chrome-extensions)
- [How I monetized my Chrome extension in 5 minutes with Stripe — Medium (Feb 2026)](https://medium.com/vibe-coders/how-i-monetized-my-chrome-extension-in-5-minutes-with-stripe-no-backend-no-content-scripts-f15f519a5612)
- [BillingExtensions — Stripe for Chrome/Edge](https://billingextensions.com/)
- [How to collect payments for a Chrome extension in 2026 — ExtensionFast](https://www.extensionfast.com/blog/how-to-collect-payments-for-your-chrome-extension-in-2026)
- [How to add subscriptions to a Chrome extension — StackBE](https://stackbe.io/blog/chrome-extension-subscriptions/)
- [Dodo Payments — monetize Chrome extension](https://dodopayments.com/blogs/monetize-chrome-extension)
- [Keygen + Stripe license integration](https://keygen.sh/integrate/stripe/)
- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies)
