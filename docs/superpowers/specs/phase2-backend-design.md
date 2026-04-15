# R3 Phase 2 Backend Design Spec
**Task:** R009
**Agent:** jarvis-ops
**Date:** 2026-04-14
**Status:** DRAFT — architecture doc, not yet approved for implementation
**Depends on:** R002 (DONE — Plan A: PRAW scraper selected)

Not legal advice. Verify Reddit API ToS compliance and PRAW usage terms before building commercial services against this spec.

---

## 1. Context

Phase 1 is complete. All Pro features (RiskCard, StatusCard) are mocked behind a Pro lock overlay. Phase 2 replaces those mocks with real data from a self-hosted PRAW-based backend service.

**R002 decision:** Phase 2 backend = Plan A — self-hosted Python service using PRAW (Python Reddit API Wrapper) to access the Reddit API.

---

## 2. Goals for Phase 2

1. **Real risk scoring:** Check whether a Reddit account is likely to have its post removed by a specific subreddit's automod rules (karma threshold, account age, flair requirements, domain bans)
2. **Real removal detection:** Check whether a submitted post is visible to logged-out users (the standard proxy for removal status)
3. **Pro licensing:** Gate the above features behind a paid tier (via ExtensionPay wrapping Stripe)

---

## 3. Architecture Overview

```
Extension (browser)
    ├── Free tier: RulesBlock (reads reddit.com/r/{sub}/about/rules.json directly — no backend)
    └── Pro tier:
         ├── RiskCard → calls /api/v1/risk?subreddit={sub}&username={user}
         └── StatusCard → calls /api/v1/post-status?post_id={id}&subreddit={sub}
               ↓
         R3 Backend Service (Python, FastAPI or Flask)
               ├── PRAW client (authenticated with Reddit OAuth, server-side only)
               ├── Redis or in-memory cache (reduce Reddit API calls)
               └── License validation endpoint (/api/v1/license)
                     ↓
               ExtensionPay or Stripe (license check)
```

---

## 4. Backend API Contract (v1)

All endpoints are unauthenticated at the network level (HTTPS only). License validation is handled per-request via the license token in the Authorization header.

### 4.1 POST /api/v1/risk

Check whether a user account is likely to have a post removed in a given subreddit.

**Request:**
```json
{
  "subreddit": "learnprogramming",
  "username": "redditor_name",
  "post_type": "link" | "self" | "image"
}
```

**Response:**
```json
{
  "subreddit": "learnprogramming",
  "username": "redditor_name",
  "risk_level": "low" | "medium" | "high",
  "factors": [
    { "factor": "karma_below_threshold", "threshold": 100, "actual": 45, "blocking": true },
    { "factor": "account_age_below_threshold", "threshold_days": 30, "actual_days": 12, "blocking": true },
    { "factor": "flair_required", "blocking": false }
  ],
  "recommendation": "High chance of removal. Account karma (45) is below the 100-karma threshold for this subreddit.",
  "cached": false,
  "cache_ttl_seconds": 300
}
```

**How the backend computes this:**
1. PRAW fetches subreddit rules and wiki (for automod config if publicly readable)
2. PRAW fetches user account karma and account age
3. Backend compares the two and scores

### 4.2 GET /api/v1/post-status

Check whether a post is visible to logged-out users.

**Request params:**
- `post_id` — Reddit post ID (e.g. `abc123`)
- `subreddit` — subreddit name

**Response:**
```json
{
  "post_id": "abc123",
  "subreddit": "learnprogramming",
  "visible_to_public": true | false,
  "status": "visible" | "removed" | "unknown",
  "checked_at": "2026-04-14T12:00:00Z",
  "cached": false
}
```

**How the backend computes this:**
- Attempt to fetch the post via the Reddit JSON API as an unauthenticated request
- If post is accessible → visible
- If 404 or post has `removed: true` flag → removed
- If private subreddit or API error → unknown

### 4.3 GET /api/v1/license

Validate a Pro license token.

**Authorization:** `Bearer {extensionpay_or_stripe_token}`

**Response:**
```json
{
  "valid": true,
  "plan": "pro",
  "expires_at": null
}
```

This endpoint proxies to ExtensionPay or checks Stripe subscription status.

---

## 5. Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | Python 3.12+ | PRAW is Python-native |
| Framework | FastAPI | Async, fast, auto-docs, type-safe |
| Reddit client | PRAW 7.x | Maintained, handles rate limiting automatically |
| Caching | Redis or in-memory dict | Reduce Reddit API calls, respect rate limits |
| Hosting | Fly.io or Railway | Cheap PaaS, simple deploy, no ops overhead |
| Auth | Bearer token (license key) | Simplest; upgrade to JWT if needed |
| HTTPS | Fly.io / Railway provides it | No manual cert management |

---

## 6. Reddit API / PRAW Compliance Notes

Not legal advice. Verify with Reddit's ToS before shipping.

- PRAW uses Reddit's official OAuth API. This is the sanctioned way to access Reddit data programmatically.
- Reddit allows 60 requests per minute for authenticated API users. PRAW handles rate limiting automatically.
- Reddit's API pricing change (2025): the $0.24/1,000 calls pricing applies to commercial services that extract and republish Reddit data. A tool that adds value on top of Reddit's data (rather than republishing it) may be in a different category. **Verify with Reddit's developer terms and consider reaching out to Reddit's business team if volume is significant.**
- Do not scrape user data with intent to deanonymize or identify individuals. R3 only reads publicly visible post data and subreddit rules.
- Reddit data fetched by the backend must not be stored longer than necessary (respect cache TTLs, do not build a Reddit data archive).

Source: [How to Scrape Reddit Legally — PainOnSocial](https://painonsocial.com/blog/how-to-scrape-reddit-legally)

---

## 7. Hosting Decision

| Option | Cost | Pros | Cons |
|---|---|---|---|
| Fly.io | ~$5–$10/month for a small machine | Free tier available, fast deploy, HTTPS | Cold starts on free tier |
| Railway | ~$5/month | Simple, GitHub-connected | Less control |
| Hetzner VPS | ~$4/month | Cheap, full control | Manual setup, no managed HTTPS |
| Render | Free tier | Free to start | Spin-down on inactivity (bad for real-time checks) |

**Recommendation:** Start on Fly.io free tier. When paying users exist, upgrade to a paid machine ($5–$10/month). Do not pay for hosting before Pro features are live and generating revenue.

---

## 8. Rate Limit Strategy

Reddit API: 60 req/min for authenticated clients.

Phase 2 volume expectations: low (R3 is a niche extension, Phase 2 will have < 100 Pro users initially).

Mitigation:
- Cache risk scores per (subreddit, username) for 5 minutes
- Cache post status per post_id for 2 minutes
- Cache subreddit rules for 1 hour (same as Phase 1 client-side cache)
- Return cached responses with a `cached: true` flag in the response

At 100 Pro users: assuming 10 checks/user/day = 1,000 checks/day = ~1 check/minute. Well within limits.

---

## 9. Security Considerations

- Backend must never expose Reddit OAuth credentials to the extension or to the public
- License tokens must be validated server-side before serving Pro data
- HTTPS required on all endpoints (handled by Fly.io/Railway)
- CORS: restrict to the extension's origin (Chrome extension IDs are stable per-install but vary by developer account — implement `Allow: *` for now, tighten later)
- No user accounts in Phase 2. License check is stateless (ExtensionPay API call per request or per session).

---

## 10. Implementation Sequence

1. Set up FastAPI skeleton with `/health` endpoint
2. Add PRAW client with environment-variable Reddit credentials
3. Implement `/api/v1/post-status` first (simpler — unauthenticated Reddit call)
4. Implement `/api/v1/risk` (more complex — requires user data + subreddit rules)
5. Add Redis caching
6. Add `/api/v1/license` endpoint (ExtensionPay integration)
7. Update extension: wire RiskCard and StatusCard to real backend endpoints
8. Deploy to Fly.io
9. QA with Pro test account on ExtensionPay

---

## 11. What Stays Local (No Backend)

Even in Phase 2, the following stays local:
- Subreddit rules display (still fetched directly from Reddit JSON by the browser)
- Per-subreddit notes (still localStorage)
- Settings (still chrome.storage)

The backend is only for Pro features that require Reddit OAuth or server-side processing.

---

## Dependencies

- R002: DONE (Plan A confirmed)
- R003: DONE (monetization research — ExtensionPay recommended)
- R010: DONE (Stripe/ExtensionPay integration research)
- Next: implement Phase 2 backend (new task, not yet in roadmap — add as R011)

---

## Sources

- [PRAW documentation](https://praw.readthedocs.io/)
- [How to use the Reddit API in 2026 — PainOnSocial](https://painonsocial.com/blog/how-to-use-reddit-api)
- [How to scrape Reddit legally — PainOnSocial](https://painonsocial.com/blog/how-to-scrape-reddit-legally)
- [FastAPI documentation](https://fastapi.tiangolo.com/)
- [Fly.io](https://fly.io/)
- [Reddit API pre-approval 2025 — ReplyDaddy](https://replydaddy.com/blog/reddit-api-pre-approval-2025-personal-projects-crackdown)
