# R3 Monetization & Payment Research
**Task:** R003
**Agent:** jarvis-research
**Date:** 2026-04-14
**Status:** complete

Not legal or financial advice. All market figures marked [UNVERIFIED] where not directly sourced.

---

## 1. Summary Recommendation

Use ExtensionPay (Stripe-backed) for Phase 2 monetization. One-time lifetime purchase at $9–$12 is the lowest-friction entry point for a utility extension. Subscriptions are viable if Phase 2 delivers ongoing server-side value (PRAW scraper = ongoing cost = subscriptions justified). Start with lifetime license to validate demand, add subscription later.

---

## 2. Monetization Models for Browser Extensions

### 2a. Freemium (recommended for R3)

- Free tier: subreddit rules display, notes (already built in Phase 1)
- Pro tier: real risk scoring, visibility/removal detection (Phase 2+)
- Strengths: low install barrier, network effects, upsell path clear
- Weaknesses: conversion rates are low (typically 1–5% of free users convert) [UNVERIFIED]
- Best for: R3's exact situation — functional free product, Pro features that require backend cost

### 2b. One-time purchase

- Pay once, unlock Pro forever
- Most common for utility extensions
- Pricing range across the market: $5–$20 one-time [UNVERIFIED based on ExtensionPay documentation and developer community data]
- Recommended starting price for R3: $9.99 lifetime (low enough to minimize friction, high enough to qualify users)
- Pros: no churn, no subscription fatigue, simpler licensing logic
- Cons: no recurring revenue, hard to raise prices later

### 2c. Subscription

- Monthly or annual recurring
- Justified when backend costs are real and ongoing (PRAW scraper = Reddit API calls, hosting, maintenance)
- Typical range: $2–$8/month for utility extensions [UNVERIFIED]
- Consider: $3.99/month or $29.99/year for R3 Pro once PRAW backend ships
- Stripe handles recurring billing; ExtensionPay wraps this cleanly

### 2d. What to avoid

- In-extension advertising: destroys trust with power users
- One-time large prices (>$25): too much friction for an unproven product
- Chrome Web Store's own payment system: shut down years ago, no longer an option

---

## 3. Payment Infrastructure Options

### Option A: ExtensionPay (recommended for Phase 2 launch)

- Purpose-built for browser extensions
- Wraps Stripe under the hood
- No backend server needed for license checking — uses their hosted service
- Fee: ~5% on top of Stripe's standard ~2.9% + 30¢ per transaction
  - Total: ~8% + 30¢ per transaction [UNVERIFIED exact rate — check extensionpay.com before signing up]
- Supports: free trials, one-time purchase, subscriptions, freemium
- Integration: small JS library in extension, no payment UI inside the extension itself
- Source: [extensionpay.com](https://extensionpay.com/)

**Why this fits R3:** No backend required at launch. You defer the PRAW backend cost until Pro revenue exists. License checking is handled by ExtensionPay's servers, not yours.

### Option B: Stripe direct (recommended for Phase 2+ once revenue justifies backend)

- Full control, lower fees (~2.9% + 30¢, no additional platform cut)
- Requires: backend server, database, license key management
- Pattern: extension opens browser tab to your hosted Stripe Checkout page → user pays → webhook fires → your backend grants Pro license → extension checks license via your API
- Chrome Web Store compliant: payment never happens inside the extension popup
- Source: [DEV Community Stripe extension guide](https://dev.to/notearthian/how-to-integrate-stripe-payments-into-a-chrome-extension-step-by-step-2gf3)

**Why to defer:** Running a backend before you have users costs money ($5–$20/month minimum). ExtensionPay defers that cost.

### Option C: Dodo Payments / Lemon Squeezy (alternative Merchant of Record)

- MoR model: they handle global taxes, VAT, compliance
- Simpler for international sales than raw Stripe
- Worth evaluating when revenue is real and international customers arrive
- Source: [Dodo Payments](https://dodopayments.com/blogs/monetize-chrome-extension)

---

## 4. Chrome Web Store Payment Policy

Key rule: **payment must never be processed inside the extension popup or content script.** The correct flow:

1. User clicks "Upgrade to Pro" in the extension
2. Extension opens a new tab pointing to your hosted checkout page (or ExtensionPay's hosted page)
3. Payment completes on the external page
4. Extension checks license status on next open (via ExtensionPay API or your own API)

This flow is fully Chrome Web Store compliant and is standard practice in 2026.

---

## 5. Revenue Potential

[All figures below are UNVERIFIED — sourced from developer community reports, not official data]

| Metric | Conservative | Optimistic |
|---|---|---|
| Installs at 6 months | 500 | 5,000 |
| Free-to-Pro conversion | 1% | 5% |
| Pro price (lifetime) | $9.99 | $9.99 |
| MRR at 6 months | — | — |
| Revenue at 6 months | $50 | $2,500 |

At 10,000 installs and 2% conversion at $9.99: ~$2,000 one-time, or ~$500–800/month on subscription.

Well-monetized extensions with 10,000 active users reportedly earn $1,000–$10,000/month [UNVERIFIED — from ExtensionRadar blog]. R3 is a niche tool (Reddit power users) with a clear value prop, which typically yields higher conversion than generic utility extensions.

---

## 6. Competitor Pricing Benchmarks

[UNVERIFIED — no direct access to competitor revenue or pricing pages; compiled from public listings]

| Extension | Model | Price |
|---|---|---|
| Reddit Enhancement Suite | Free (donations) | $0 |
| Moderator Toolbox | Free | $0 |
| Most shadowban checkers | Free web tools | $0 |
| Grammar/writing extensions (analogous) | Freemium | $12–$30/month |
| AI-powered content tools | Subscription | $5–$15/month |

Gap identified: no paid Reddit utility extension with a clear Pro tier currently exists. The market is entirely free-tool dominated. R3 Pro can own this niche if the Phase 2 features deliver real value.

---

## 7. Recommended Phased Approach

**Phase 2 launch (PRAW backend ships):**
- Launch Pro at $9.99 lifetime via ExtensionPay
- No subscription yet — validate demand first
- Target: 50 paying users before switching to subscription model

**Phase 3 (if recurring costs justify it):**
- Add $3.99/month or $29.99/year subscription tier
- Keep lifetime option at a higher price ($19.99–$24.99)
- Use Stripe directly once backend is running anyway

---

## Sources

- [ExtensionPay — monetize Chrome extensions with payments](https://extensionpay.com/)
- [ExtensionPay: add Stripe payments to Chrome extensions](https://extensionpay.com/articles/add-stripe-payments-to-chrome-extensions)
- [How to Monetize a Chrome Extension in 2026 — Dodo Payments](https://dodopayments.com/blogs/monetize-chrome-extension)
- [How to Monetize Your Chrome Extension (5 Proven Models) — ExtensionRadar](https://www.extensionradar.com/blog/how-to-monetize-chrome-extension)
- [How to integrate Stripe into a Chrome extension — DEV Community](https://dev.to/notearthian/how-to-integrate-stripe-payments-into-a-chrome-extension-step-by-step-2gf3)
- [How to collect payments for Chrome extension in 2026 — ExtensionFast](https://www.extensionfast.com/blog/how-to-collect-payments-for-your-chrome-extension-in-2026)
- [Indie Hackers: how to take payments in browser extensions](https://www.indiehackers.com/post/how-to-take-payments-in-browser-extensions-e33e990438)
