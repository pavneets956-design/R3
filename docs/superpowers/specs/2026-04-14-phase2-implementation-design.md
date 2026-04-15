# R3 Phase 2 — Implementation Design Spec

**Date:** 2026-04-14
**Status:** Approved for implementation
**Roadmap item:** R011
**Depends on:** R009 (done), R002 (done), R003 (done)

---

## 1. Scope

Phase 2 replaces the mocked Pro features (RiskCard, StatusCard) with real data from a self-hosted FastAPI + PRAW backend service. Phase 1 extension code is untouched except where wiring is added.

**In scope:**
- `backend/` service (FastAPI + PRAW)
- Extension `backendClient.ts` API layer
- Wired RiskCard and StatusCard components
- Pro-gating via license stub

**Out of scope:**
- Real ExtensionPay / Stripe payment integration (Phase 2.5)
- Marketing site, CWS submission
- Redis (in-memory cache only in Phase 2)

---

## 2. Monorepo Structure

Backend lives at top-level `backend/`. Extension stays entirely under `src/`.

```
backend/
  app/
    main.py              # FastAPI app, router registration, CORS, startup
    config.py            # All env vars + TTLs + flags in one place
    praw_client.py       # PRAW singleton, initialized once at startup
    cache.py             # In-memory TTL cache
    models.py            # Pydantic request/response models
    routes/
      license.py         # GET /api/v1/license
      post_status.py     # GET /api/v1/post-status
      risk.py            # POST /api/v1/risk
    services/
      license_service.py
      post_status_service.py
      risk_service.py
  tests/
    test_license.py
    test_post_status.py
    test_risk.py
  requirements.txt       # fastapi, uvicorn, praw, pytest, httpx, python-dotenv
  Dockerfile
  .env.example
  README.md
```

---

## 3. Implementation Order (Vertical Slices)

Each slice is fully completed (backend route + service + tests + extension wiring + manual verification) before the next begins.

1. **License stub** — establishes Pro-gating contract, feature flags shape
2. **Post-status** — first real end-to-end feature, unauthenticated Reddit check
3. **Risk** — most complex, heuristic-based, built on working pipeline

---

## 4. Config (`config.py`)

All configuration read from environment variables, never scattered across files.

| Variable | Description | Default |
|---|---|---|
| `REDDIT_CLIENT_ID` | Reddit OAuth app client ID | required |
| `REDDIT_CLIENT_SECRET` | Reddit OAuth app secret | required |
| `REDDIT_USER_AGENT` | PRAW user agent string | `r3-backend/0.1` |
| `LICENSE_MODE` | `stub` or `live` | `stub` |
| `DEV_TOKEN` | Static token accepted in stub mode | `dev-token-phase2` |
| `CACHE_TTL_RISK` | Seconds to cache risk results | `300` |
| `CACHE_TTL_POST_STATUS` | Seconds to cache post status | `120` |
| `CACHE_TTL_SUBREDDIT_META` | Seconds to cache subreddit rules | `3600` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `*` |

---

## 5. Phase 2 Auth / Token Story

**Problem:** Bearer tokens need a defined story before requiring them everywhere.

**Phase 2 approach (stub mode):**
- Extension sends `Authorization: Bearer dev-token-phase2` on all requests
- Backend (`LICENSE_MODE=stub`) accepts this static token without verification
- Token is stored in `chrome.storage.local` by the options page (dev sets it once)
- Header shape is production-ready; only the validation logic is stubbed

**Future (live mode):**
- Extension retrieves a real ExtensionPay token after payment
- Backend validates token against ExtensionPay API
- No extension-side changes needed — same header, same storage pattern

---

## 6. API Contract

### 6.1 GET /api/v1/license

**Authorization:** `Bearer {token}`

**Response:**
```json
{
  "valid": true,
  "plan": "pro",
  "expires_at": null,
  "features": {
    "risk": true,
    "post_status": true
  }
}
```

**Cache:** Session memory in extension (no backend cache needed).

**Stub behaviour:** Always returns `valid: true` when `LICENSE_MODE=stub`.

---

### 6.2 GET /api/v1/post-status

**Authorization:** `Bearer {token}`

**Params:** `?post_id={id}&subreddit={sub}`

**Response:**
```json
{
  "post_id": "abc123",
  "subreddit": "learnprogramming",
  "status": "visible | removed | unknown",
  "visible_to_public": true,
  "reason_hint": "missing_from_listing | deleted_by_author | fetch_failed | insufficient_signal | null",
  "checked_at": "2026-04-14T12:00:00Z",
  "cached": false
}
```

**How the backend computes this:**
- Service constructs a defensive lookup from `post_id` (normalizes to permalink form)
- Fetches `reddit.com/r/{sub}/comments/{id}.json` as unauthenticated request (no PRAW)
- If 200 and post present → `visible`, `reason_hint: null`
- If 404 or post has `removed: true` → `removed`, `reason_hint: missing_from_listing`
- If post has no content but exists → `removed`, `reason_hint: deleted_by_author`
- If private sub or API error → `unknown`, `reason_hint: fetch_failed`
- If response is ambiguous → `unknown`, `reason_hint: insufficient_signal`

**Cache key:** `post_status:{post_id}` — TTL 2 minutes.

---

### 6.3 POST /api/v1/risk

**Authorization:** `Bearer {token}`

**Request:**
```json
{
  "subreddit": "learnprogramming",
  "username": "redditor_name",
  "post_type": "text | link | image | video | unknown"
}
```

**Optional future fields (not implemented Phase 2):**
- `title_length`, `has_url`, `has_body`, `flair_selected`

**Response:**
```json
{
  "subreddit": "learnprogramming",
  "username": "redditor_name",
  "risk_level": "low | medium | high",
  "confidence": "low | medium | high",
  "factors": [
    {
      "type": "account_age",
      "impact": "high",
      "message": "Account appears newer than typical accepted posters."
    },
    {
      "type": "karma",
      "impact": "medium",
      "message": "User karma may be below inferred threshold."
    },
    {
      "type": "flair_required",
      "impact": "low",
      "message": "This subreddit requires post flair."
    }
  ],
  "recommendation": "High removal risk. Account karma and age are below typical thresholds for this subreddit.",
  "cached": false
}
```

**Confidence logic:**
- `high` — subreddit has readable automod config + user data is complete
- `medium` — automod config unavailable but subreddit rules give signal; or user history is sparse
- `low` — most signals missing; prediction is mostly heuristic

**How the backend computes this:**
1. PRAW fetches subreddit rules and wiki (automod config if publicly readable)
2. PRAW fetches user karma + account age
3. Service compares and scores per factor
4. Derives `risk_level` and `confidence` from factor count/weight

**Cache keys:**
- `risk:{subreddit}:{username}:{post_type}` — TTL 5 minutes
- `subreddit_meta:{subreddit}` — TTL 1 hour

---

## 7. Cache Strategy

In-memory dict with TTL stored alongside each entry. No Redis in Phase 2.

```python
# cache.py interface
cache.get(key) -> value | None
cache.set(key, value, ttl_seconds)
cache.invalidate(key)
```

Cache keys defined above in §6. No other cache keys. TTLs sourced from `config.py`.

---

## 8. Error Handling

### Backend responses

| Scenario | Status | Body |
|---|---|---|
| Invalid/missing token | 401 | `{ "error": "unauthorized" }` |
| Reddit rate limit | 429 | `{ "error": "rate_limited", "retry_after": N }` |
| PRAW auth failure | 503 | `{ "error": "backend_unavailable" }` |
| Bad params | 422 | FastAPI default (Pydantic validation) |
| Unknown post/private sub | 200 | `status: "unknown"`, `reason_hint` set |

### Extension error handling

| Backend response | Extension behaviour |
|---|---|
| 401 | Re-show Pro overlay |
| 429 | Show "checking… try again in N seconds" |
| 503 | Show "service unavailable, try again later" |
| Network failure | Silent fallback; show last cached value if available |

---

## 9. Extension Wiring

New file: `src/panel/api/backendClient.ts`
- Reads backend base URL from `config.py` equivalent (env var at build time or options page)
- Attaches `Authorization: Bearer {token}` header to all requests
- Token sourced from `chrome.storage.local`
- Exports `fetchLicense()`, `fetchPostStatus()`, `fetchRisk()`

RiskCard and StatusCard are updated per slice:
- Replace static mock markup with loading/error/success states
- Pro overlay removed once `features.risk` / `features.post_status` returns true

---

## 10. Testing

**Backend:**
- `pytest` + HTTPX test client
- PRAW client mocked in all tests (never hits Reddit in CI)
- Each service has unit tests; each route has integration tests
- Test for: happy path, missing token (401), Reddit error (503), cache hit

**Extension:**
- Existing Vitest setup
- RiskCard and StatusCard get tests for: loading state, error state, success state, Pro-locked state
- `backendClient.ts` is mocked in component tests

**Acceptance gate per slice:** manual verification in Chrome with extension loaded unpacked.

---

## 11. Deployment

**Local dev:**
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Fly.io (after at least one slice works locally):**
- `Dockerfile` included
- `fly.toml` included but not central to design
- Deploy only after local end-to-end is verified

---

## 12. What Stays Local (No Backend)

- Subreddit rules display — still fetched directly from Reddit JSON by the browser
- Per-subreddit notes — still localStorage
- Settings — still `chrome.storage`
