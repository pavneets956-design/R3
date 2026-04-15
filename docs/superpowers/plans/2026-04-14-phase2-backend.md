# R3 Phase 2 — Backend + Extension Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI + PRAW backend in `backend/`, deploy to Fly.io, and wire RiskCard + StatusCard to real data — replacing Phase 1 mocks.

**Architecture:** Monorepo — `backend/` (Python FastAPI) alongside existing `src/` (TypeScript extension). Three vertical slices in order: license stub → post-status → risk. Each slice completes backend + extension wiring before the next begins.

**Tech Stack:** Python 3.12+, FastAPI, PRAW 7.x, httpx, pydantic-settings, pytest + pytest-asyncio; TypeScript extension unchanged except new `backendClient.ts` and wired components.

---

## File Map

### Backend — new files

| File | Responsibility |
|---|---|
| `backend/app/__init__.py` | Package marker |
| `backend/app/main.py` | FastAPI app, router registration, CORS, `/health` |
| `backend/app/config.py` | All env vars + TTLs + flags (single source of truth) |
| `backend/app/cache.py` | In-memory TTL cache + sliding-window rate limiter |
| `backend/app/auth.py` | `require_token` dependency + `make_rate_limit_dep` factory |
| `backend/app/models.py` | All Pydantic request/response models |
| `backend/app/praw_client.py` | PRAW singleton, initialized once at startup |
| `backend/app/routes/__init__.py` | Package marker |
| `backend/app/routes/license.py` | `GET /api/v1/license` |
| `backend/app/routes/post_status.py` | `GET /api/v1/post-status` |
| `backend/app/routes/risk.py` | `POST /api/v1/risk` |
| `backend/app/services/__init__.py` | Package marker |
| `backend/app/services/license_service.py` | License validation logic |
| `backend/app/services/post_status_service.py` | Post visibility check logic |
| `backend/app/services/risk_service.py` | Risk scoring logic (PRAW-based) |
| `backend/tests/__init__.py` | Package marker |
| `backend/tests/conftest.py` | Test app, fixtures, env override |
| `backend/tests/test_license.py` | License endpoint tests |
| `backend/tests/test_post_status.py` | Post-status endpoint tests |
| `backend/tests/test_risk.py` | Risk endpoint tests |
| `backend/requirements.txt` | Python dependencies |
| `backend/pytest.ini` | pytest config (`asyncio_mode = auto`) |
| `backend/Dockerfile` | Container build for Fly.io |
| `backend/fly.toml` | Fly.io app config |
| `backend/.env.example` | Env var template |
| `backend/README.md` | Local setup, run, test, curl examples |

### Extension — new files

| File | Responsibility |
|---|---|
| `src/panel/api/backendClient.ts` | Token retrieval, auth headers, typed fetch wrappers |

### Extension — modified files

| File | Change |
|---|---|
| `src/options/options.tsx` | Add Pro token input section |
| `src/panel/components/StatusCard.tsx` | Replace mock with real API call |
| `src/panel/components/RiskCard.tsx` | Replace mock with real API call |
| `tests/components/StatusCard.test.tsx` | Replace mock assertions with loading/error/success states |
| `tests/components/RiskCard.test.tsx` | Replace mock assertions with loading/error/success states |

---

## Task 1: Reddit OAuth App Setup (Manual)

**Files:** none (manual Reddit setup)

This must be done before any backend code that uses PRAW runs. PRAW only needs read-only access — no Reddit account credentials needed, just a Reddit "script" app.

- [ ] **Step 1: Create Reddit app**

  Go to https://www.reddit.com/prefs/apps (logged in to your Reddit account).
  Click "create another app…" at the bottom.
  Fill in:
  - Name: `r3-backend`
  - Type: **script**
  - Description: `R3 extension backend`
  - About URL: (leave blank)
  - Redirect URI: `http://localhost:8080` (required by form, not used)

  Click "create app".

- [ ] **Step 2: Record credentials**

  After creation you'll see:
  - **client_id**: the string shown directly under the app name (looks like `abc123xyz`)
  - **client_secret**: shown as "secret"

  Keep these handy — you'll add them to `backend/.env` in Task 2.

- [ ] **Step 3: Verify app type**

  Confirm the app shows type = "script". This gives read-only access to public Reddit data without requiring a username/password.

---

## Task 2: Backend Project Skeleton

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/app/routes/__init__.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/.env.example`
- Create: `backend/.env` (local only, not committed)

- [ ] **Step 1: Write the failing health test**

  Create `backend/tests/conftest.py`:
  ```python
  import os
  import pytest
  from httpx import AsyncClient, ASGITransport

  # Set env before app import so config.py reads them
  os.environ.setdefault("REDDIT_CLIENT_ID", "test-client-id")
  os.environ.setdefault("REDDIT_CLIENT_SECRET", "test-client-secret")
  os.environ.setdefault("LICENSE_MODE", "stub")
  os.environ.setdefault("DEV_TOKEN", "test-token")

  from app.main import app  # noqa: E402

  @pytest.fixture
  async def client():
      async with AsyncClient(
          transport=ASGITransport(app=app), base_url="http://test"
      ) as ac:
          yield ac

  @pytest.fixture
  def auth_headers():
      return {"Authorization": "Bearer test-token"}
  ```

  Create `backend/tests/__init__.py` (empty).

  Create `backend/tests/test_health.py`:
  ```python
  import pytest

  @pytest.mark.asyncio
  async def test_health(client):
      resp = await client.get("/health")
      assert resp.status_code == 200
      assert resp.json() == {"status": "ok"}
  ```

- [ ] **Step 2: Create requirements.txt**

  Create `backend/requirements.txt`:
  ```
  fastapi==0.115.0
  uvicorn[standard]==0.30.6
  praw==7.7.1
  httpx==0.27.0
  pydantic-settings==2.5.2
  python-dotenv==1.0.1
  pytest==8.3.3
  pytest-asyncio==0.24.0
  anyio==4.6.0
  ```

- [ ] **Step 3: Create pytest.ini**

  Create `backend/pytest.ini`:
  ```ini
  [pytest]
  asyncio_mode = auto
  testpaths = tests
  ```

- [ ] **Step 4: Install dependencies**

  ```bash
  cd backend
  python -m venv .venv
  # Windows:
  .venv\Scripts\activate
  pip install -r requirements.txt
  ```

  Expected: all packages install without errors.

- [ ] **Step 5: Create config.py**

  Create `backend/app/config.py`:
  ```python
  from pydantic_settings import BaseSettings, SettingsConfigDict


  class Settings(BaseSettings):
      model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

      reddit_client_id: str
      reddit_client_secret: str
      reddit_user_agent: str = "r3-backend/0.1"
      license_mode: str = "stub"
      dev_token: str = "dev-token-phase2"
      cache_ttl_risk: int = 300
      cache_ttl_post_status: int = 120
      cache_ttl_subreddit_meta: int = 3600
      cors_origins: str = "*"


  settings = Settings()
  ```

- [ ] **Step 6: Create package markers**

  Create `backend/app/__init__.py` (empty).
  Create `backend/app/routes/__init__.py` (empty).
  Create `backend/app/services/__init__.py` (empty).

- [ ] **Step 7: Create main.py with health endpoint**

  Create `backend/app/main.py`:
  ```python
  from fastapi import FastAPI
  from fastapi.middleware.cors import CORSMiddleware
  from app.config import settings

  app = FastAPI(title="R3 Backend", version="0.1.0")

  app.add_middleware(
      CORSMiddleware,
      allow_origins=settings.cors_origins.split(","),
      allow_methods=["GET", "POST"],
      allow_headers=["Authorization", "Content-Type"],
  )


  @app.get("/health")
  def health():
      return {"status": "ok"}
  ```

- [ ] **Step 8: Run the health test — expect PASS**

  ```bash
  cd backend
  pytest tests/test_health.py -v
  ```

  Expected:
  ```
  tests/test_health.py::test_health PASSED
  ```

- [ ] **Step 9: Create .env.example and .env**

  Create `backend/.env.example`:
  ```
  REDDIT_CLIENT_ID=your_reddit_client_id_here
  REDDIT_CLIENT_SECRET=your_reddit_client_secret_here
  REDDIT_USER_AGENT=r3-backend/0.1
  LICENSE_MODE=stub
  DEV_TOKEN=dev-token-phase2
  ```

  Create `backend/.env` (not committed — fill in real credentials from Task 1):
  ```
  REDDIT_CLIENT_ID=<your_client_id>
  REDDIT_CLIENT_SECRET=<your_client_secret>
  REDDIT_USER_AGENT=r3-backend/0.1
  LICENSE_MODE=stub
  DEV_TOKEN=dev-token-phase2
  ```

- [ ] **Step 10: Verify server starts**

  ```bash
  cd backend
  uvicorn app.main:app --reload --port 8000
  ```

  Expected: `INFO: Application startup complete.`
  Test: `curl http://localhost:8000/health` → `{"status":"ok"}`

- [ ] **Step 11: Commit**

  ```bash
  git add backend/
  git commit -m "feat: backend skeleton — FastAPI app, config, health endpoint"
  ```

---

## Task 3: Cache + Rate Limiter

**Files:**
- Create: `backend/app/cache.py`
- Test: `backend/tests/test_cache.py`

- [ ] **Step 1: Write failing tests**

  Create `backend/tests/test_cache.py`:
  ```python
  import time
  import pytest
  from app.cache import TTLCache, RateLimiter


  class TestTTLCache:
      def test_miss_returns_none(self):
          c = TTLCache()
          assert c.get("missing") is None

      def test_set_and_get(self):
          c = TTLCache()
          c.set("k", "v", ttl_seconds=60)
          assert c.get("k") == "v"

      def test_expired_returns_none(self):
          c = TTLCache()
          c.set("k", "v", ttl_seconds=0)
          time.sleep(0.01)
          assert c.get("k") is None

      def test_invalidate(self):
          c = TTLCache()
          c.set("k", "v", ttl_seconds=60)
          c.invalidate("k")
          assert c.get("k") is None


  class TestRateLimiter:
      def test_allows_first_request(self):
          rl = RateLimiter()
          allowed, retry_after = rl.check("key", max_requests=5, window_seconds=10)
          assert allowed is True
          assert retry_after == 0

      def test_blocks_after_limit(self):
          rl = RateLimiter()
          for _ in range(3):
              rl.check("key", max_requests=3, window_seconds=10)
          allowed, retry_after = rl.check("key", max_requests=3, window_seconds=10)
          assert allowed is False
          assert retry_after > 0

      def test_different_keys_are_independent(self):
          rl = RateLimiter()
          for _ in range(3):
              rl.check("key-a", max_requests=3, window_seconds=10)
          allowed, _ = rl.check("key-b", max_requests=3, window_seconds=10)
          assert allowed is True
  ```

- [ ] **Step 2: Run tests — expect FAIL**

  ```bash
  cd backend
  pytest tests/test_cache.py -v
  ```

  Expected: `ImportError: cannot import name 'TTLCache' from 'app.cache'`

- [ ] **Step 3: Implement cache.py**

  Create `backend/app/cache.py`:
  ```python
  import time
  from typing import Any


  class TTLCache:
      def __init__(self) -> None:
          self._store: dict[str, tuple[Any, float]] = {}

      def get(self, key: str) -> Any | None:
          entry = self._store.get(key)
          if entry is None:
              return None
          value, expires_at = entry
          if time.time() > expires_at:
              del self._store[key]
              return None
          return value

      def set(self, key: str, value: Any, ttl_seconds: int) -> None:
          self._store[key] = (value, time.time() + ttl_seconds)

      def invalidate(self, key: str) -> None:
          self._store.pop(key, None)


  class RateLimiter:
      def __init__(self) -> None:
          self._windows: dict[str, list[float]] = {}

      def check(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
          """Returns (allowed, retry_after_seconds). Records the request if allowed."""
          now = time.time()
          timestamps = [t for t in self._windows.get(key, []) if now - t < window_seconds]

          if len(timestamps) >= max_requests:
              oldest = timestamps[0]
              retry_after = int(window_seconds - (now - oldest)) + 1
              self._windows[key] = timestamps
              return False, retry_after

          timestamps.append(now)
          self._windows[key] = timestamps
          return True, 0


  # Module-level singletons used by routes
  cache = TTLCache()
  rate_limiter = RateLimiter()
  ```

- [ ] **Step 4: Run tests — expect PASS**

  ```bash
  cd backend
  pytest tests/test_cache.py -v
  ```

  Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/app/cache.py backend/tests/test_cache.py
  git commit -m "feat: in-memory TTL cache and sliding-window rate limiter"
  ```

---

## Task 4: Auth Dependency + Pydantic Models

**Files:**
- Create: `backend/app/auth.py`
- Create: `backend/app/models.py`
- Test: `backend/tests/test_auth.py`

- [ ] **Step 1: Write failing auth tests**

  Create `backend/tests/test_auth.py`:
  ```python
  import pytest


  @pytest.mark.asyncio
  async def test_missing_auth_header_returns_401(client):
      resp = await client.get("/api/v1/license")
      assert resp.status_code == 401

  @pytest.mark.asyncio
  async def test_wrong_token_returns_401(client):
      resp = await client.get(
          "/api/v1/license",
          headers={"Authorization": "Bearer wrong-token"},
      )
      assert resp.status_code == 401

  @pytest.mark.asyncio
  async def test_valid_dev_token_accepted(client, auth_headers):
      # License route doesn't exist yet, but auth should pass → 404 not 401
      resp = await client.get("/api/v1/license", headers=auth_headers)
      assert resp.status_code != 401
  ```

  Note: the last test will pass once the license route exists (Task 5). For now it's 404.

- [ ] **Step 2: Run tests — expect last test to fail (404 ≠ 401 is actually a pass; the test expects != 401)**

  ```bash
  cd backend
  pytest tests/test_auth.py -v
  ```

  Expected: first two FAIL (no route yet → 404, not 401). This tells us auth isn't wired yet.

- [ ] **Step 3: Create auth.py**

  Create `backend/app/auth.py`:
  ```python
  from fastapi import Header, HTTPException, Depends
  from app.config import settings
  from app.cache import rate_limiter


  async def require_token(authorization: str = Header(...)) -> str:
      """Validate Authorization: Bearer {token} header. Returns the token."""
      if not authorization.startswith("Bearer "):
          raise HTTPException(status_code=401, detail={"error": "unauthorized"})
      token = authorization[7:].strip()
      if settings.license_mode == "stub" and token == settings.dev_token:
          return token
      raise HTTPException(status_code=401, detail={"error": "unauthorized"})


  def make_rate_limit_dep(endpoint: str, max_requests: int, window_seconds: int):
      """Factory for per-endpoint rate limit dependencies."""
      async def _check(token: str = Depends(require_token)) -> str:
          allowed, retry_after = rate_limiter.check(
              f"ratelimit:{token}:{endpoint}", max_requests, window_seconds
          )
          if not allowed:
              raise HTTPException(
                  status_code=429,
                  detail={"error": "rate_limited", "retry_after": retry_after},
              )
          return token
      return _check
  ```

- [ ] **Step 4: Create models.py**

  Create `backend/app/models.py`:
  ```python
  from __future__ import annotations
  from typing import Literal
  from pydantic import BaseModel


  # ── License ───────────────────────────────────────────────────────────────────

  class LicenseFeatures(BaseModel):
      risk: bool = True
      post_status: bool = True


  class LicenseResponse(BaseModel):
      valid: bool
      plan: str
      expires_at: str | None
      features: LicenseFeatures


  # ── Post Status ───────────────────────────────────────────────────────────────

  ReasonHint = Literal[
      "missing_from_listing",
      "deleted_by_author",
      "fetch_failed",
      "insufficient_signal",
  ]


  class PostStatusResponse(BaseModel):
      post_id: str
      subreddit: str
      status: Literal["visible", "removed", "unknown"]
      visible_to_public: bool
      reason_hint: ReasonHint | None
      checked_at: str
      cached: bool


  # ── Risk ─────────────────────────────────────────────────────────────────────

  PostType = Literal["text", "link", "image", "video", "unknown"]
  ImpactLevel = Literal["high", "medium", "low"]
  RiskLevel = Literal["low", "medium", "high"]
  ConfidenceLevel = Literal["low", "medium", "high"]


  class RiskFactor(BaseModel):
      type: str
      impact: ImpactLevel
      message: str


  class RiskRequest(BaseModel):
      subreddit: str
      username: str
      post_type: PostType = "unknown"


  class RiskResponse(BaseModel):
      subreddit: str
      username: str
      risk_level: RiskLevel
      confidence: ConfidenceLevel
      factors: list[RiskFactor]
      recommendation: str
      cached: bool
  ```

- [ ] **Step 5: Wire a stub license route so auth tests can run**

  Create `backend/app/routes/license.py` (stub — real implementation in Task 5):
  ```python
  from fastapi import APIRouter, Depends
  from app.auth import require_token
  from app.models import LicenseResponse, LicenseFeatures

  router = APIRouter()


  @router.get("/license", response_model=LicenseResponse)
  async def get_license(token: str = Depends(require_token)):
      return LicenseResponse(
          valid=True,
          plan="pro",
          expires_at=None,
          features=LicenseFeatures(),
      )
  ```

  Update `backend/app/main.py`:
  ```python
  from fastapi import FastAPI
  from fastapi.middleware.cors import CORSMiddleware
  from app.config import settings
  from app.routes import license as license_router

  app = FastAPI(title="R3 Backend", version="0.1.0")

  app.add_middleware(
      CORSMiddleware,
      allow_origins=settings.cors_origins.split(","),
      allow_methods=["GET", "POST"],
      allow_headers=["Authorization", "Content-Type"],
  )

  app.include_router(license_router.router, prefix="/api/v1")


  @app.get("/health")
  def health():
      return {"status": "ok"}
  ```

- [ ] **Step 6: Run all tests — expect PASS**

  ```bash
  cd backend
  pytest tests/test_auth.py tests/test_health.py tests/test_cache.py -v
  ```

  Expected: all tests PASS.

- [ ] **Step 7: Commit**

  ```bash
  git add backend/app/auth.py backend/app/models.py backend/app/routes/license.py backend/app/main.py backend/tests/test_auth.py
  git commit -m "feat: auth dependency, Pydantic models, stub license route"
  ```

---

## Task 5: License Slice — Service + Tests

**Files:**
- Create: `backend/app/services/license_service.py`
- Modify: `backend/app/routes/license.py` (thin route calling service)
- Create: `backend/tests/test_license.py`

- [ ] **Step 1: Write failing license tests**

  Create `backend/tests/test_license.py`:
  ```python
  import pytest


  @pytest.mark.asyncio
  async def test_license_valid_dev_token(client, auth_headers):
      resp = await client.get("/api/v1/license", headers=auth_headers)
      assert resp.status_code == 200
      data = resp.json()
      assert data["valid"] is True
      assert data["plan"] == "pro"
      assert data["expires_at"] is None
      assert data["features"]["risk"] is True
      assert data["features"]["post_status"] is True


  @pytest.mark.asyncio
  async def test_license_missing_token(client):
      resp = await client.get("/api/v1/license")
      assert resp.status_code == 401
      assert resp.json()["detail"]["error"] == "unauthorized"


  @pytest.mark.asyncio
  async def test_license_wrong_token(client):
      resp = await client.get(
          "/api/v1/license",
          headers={"Authorization": "Bearer not-the-dev-token"},
      )
      assert resp.status_code == 401
  ```

- [ ] **Step 2: Run tests — expect PASS (stub already satisfies this)**

  ```bash
  cd backend
  pytest tests/test_license.py -v
  ```

  Expected: all 3 PASS. The stub in Task 4 already satisfies these contracts.

- [ ] **Step 3: Extract service layer**

  Create `backend/app/services/license_service.py`:
  ```python
  from app.models import LicenseResponse, LicenseFeatures


  def get_license() -> LicenseResponse:
      """Return license status. Phase 2: always valid in stub mode.
      Phase 2.5: replace with ExtensionPay API call."""
      return LicenseResponse(
          valid=True,
          plan="pro",
          expires_at=None,
          features=LicenseFeatures(risk=True, post_status=True),
      )
  ```

  Update `backend/app/routes/license.py` to use the service (route stays thin):
  ```python
  from fastapi import APIRouter, Depends
  from app.auth import require_token
  from app.models import LicenseResponse
  from app.services.license_service import get_license

  router = APIRouter()


  @router.get("/license", response_model=LicenseResponse)
  async def get_license_route(token: str = Depends(require_token)):
      return get_license()
  ```

- [ ] **Step 4: Run tests — expect PASS**

  ```bash
  cd backend
  pytest tests/test_license.py -v
  ```

  Expected: all 3 PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/app/services/license_service.py backend/app/routes/license.py backend/tests/test_license.py
  git commit -m "feat: license slice — service layer, full test coverage"
  ```

---

## Task 6: Extension — backendClient.ts + Token Storage

**Files:**
- Create: `src/panel/api/backendClient.ts`
- Modify: `src/options/options.tsx`
- Create: `.env` (extension root, local only)

This task wires the extension side of the license check. The token is stored in `chrome.storage.local` (accessible from both the options page and the content script panel).

- [ ] **Step 1: Add VITE_BACKEND_URL env var**

  Create `.env` in the extension root (next to `package.json`):
  ```
  VITE_BACKEND_URL=http://localhost:8000
  ```

  This file is not committed. For production builds, set `VITE_BACKEND_URL` in CI.

- [ ] **Step 2: Create backendClient.ts**

  Create `src/panel/api/backendClient.ts`:
  ```typescript
  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000';
  export const PRO_TOKEN_KEY = 'r3_pro_token';

  // ── Token helpers ──────────────────────────────────────────────────────────

  export async function getProToken(): Promise<string | null> {
    return new Promise(resolve => {
      chrome.storage.local.get([PRO_TOKEN_KEY], result => {
        resolve((result[PRO_TOKEN_KEY] as string | undefined) ?? null);
      });
    });
  }

  export async function setProToken(token: string): Promise<void> {
    return new Promise(resolve => {
      chrome.storage.local.set({ [PRO_TOKEN_KEY]: token }, resolve);
    });
  }

  export async function clearProToken(): Promise<void> {
    return new Promise(resolve => {
      chrome.storage.local.remove([PRO_TOKEN_KEY], resolve);
    });
  }

  // ── Base fetch ─────────────────────────────────────────────────────────────

  /** Throws 'NO_TOKEN' if token missing — caller should fall back to guest mode. */
  async function backendFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const token = await getProToken();
    if (!token) throw new Error('NO_TOKEN');
    return fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
  }

  // ── Response types ─────────────────────────────────────────────────────────

  export interface LicenseFeatures {
    risk: boolean;
    post_status: boolean;
  }

  export interface LicenseResponse {
    valid: boolean;
    plan: string;
    expires_at: string | null;
    features: LicenseFeatures;
  }

  export interface PostStatusResponse {
    post_id: string;
    subreddit: string;
    status: 'visible' | 'removed' | 'unknown';
    visible_to_public: boolean;
    reason_hint:
      | 'missing_from_listing'
      | 'deleted_by_author'
      | 'fetch_failed'
      | 'insufficient_signal'
      | null;
    checked_at: string;
    cached: boolean;
  }

  export interface RiskFactor {
    type: string;
    impact: 'high' | 'medium' | 'low';
    message: string;
  }

  export interface RiskResponse {
    subreddit: string;
    username: string;
    risk_level: 'low' | 'medium' | 'high';
    confidence: 'low' | 'medium' | 'high';
    factors: RiskFactor[];
    recommendation: string;
    cached: boolean;
  }

  // ── API calls ──────────────────────────────────────────────────────────────

  export async function fetchLicense(): Promise<LicenseResponse> {
    const resp = await backendFetch('/api/v1/license');
    if (resp.status === 401) throw new Error('UNAUTHORIZED');
    if (!resp.ok) throw new Error(`LICENSE_ERROR:${resp.status}`);
    return resp.json() as Promise<LicenseResponse>;
  }

  export async function fetchPostStatus(
    postId: string,
    subreddit: string
  ): Promise<PostStatusResponse> {
    const params = new URLSearchParams({ post_id: postId, subreddit });
    const resp = await backendFetch(`/api/v1/post-status?${params}`);
    if (resp.status === 401) throw new Error('UNAUTHORIZED');
    if (resp.status === 429) {
      const body = await resp.json() as { error: string; retry_after: number };
      throw new Error(`RATE_LIMITED:${body.retry_after}`);
    }
    if (!resp.ok) throw new Error(`POST_STATUS_ERROR:${resp.status}`);
    return resp.json() as Promise<PostStatusResponse>;
  }

  export async function fetchRisk(
    subreddit: string,
    username: string,
    postType: 'text' | 'link' | 'image' | 'video' | 'unknown' = 'unknown'
  ): Promise<RiskResponse> {
    const resp = await backendFetch('/api/v1/risk', {
      method: 'POST',
      body: JSON.stringify({ subreddit, username, post_type: postType }),
    });
    if (resp.status === 401) throw new Error('UNAUTHORIZED');
    if (resp.status === 429) {
      const body = await resp.json() as { error: string; retry_after: number };
      throw new Error(`RATE_LIMITED:${body.retry_after}`);
    }
    if (!resp.ok) throw new Error(`RISK_ERROR:${resp.status}`);
    return resp.json() as Promise<RiskResponse>;
  }
  ```

- [ ] **Step 3: Add Pro token section to options page**

  Open `src/options/options.tsx`. Add a `ProTokenSection` component and render it after the existing settings section.

  Replace the full file with:
  ```tsx
  import { useState, useEffect } from 'react';
  import { createRoot } from 'react-dom/client';
  import { getPrefs, setPrefs, clearAllData } from '../panel/storage';
  import { clearLogs } from '../shared/logger';
  import { getProToken, setProToken, clearProToken } from '../panel/api/backendClient';
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

        <ProTokenSection />

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

  function ProTokenSection() {
    const [token, setTokenState] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
      getProToken().then(t => { if (t) setTokenState(t); });
    }, []);

    async function handleSave() {
      const trimmed = token.trim();
      if (trimmed) {
        await setProToken(trimmed);
      } else {
        await clearProToken();
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }

    return (
      <section style={{ background: '#fff', borderRadius: 8, border: '1px solid #edeff1', padding: 24, marginBottom: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Pro license token</div>
        <div style={{ fontSize: 13, color: '#7c7c7c', marginBottom: 12 }}>
          Enter your Pro license token to unlock risk scoring and post visibility checks.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={token}
            onChange={e => setTokenState(e.target.value)}
            placeholder="dev-token-phase2"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #edeff1',
              borderRadius: 4,
              fontSize: 13,
              fontFamily: 'monospace',
            }}
          />
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              background: saved ? '#4caf50' : '#ff4500',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </section>
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

- [ ] **Step 4: Build extension and verify options page**

  ```bash
  npm run build
  ```

  Expected: build succeeds, no TypeScript errors.

  Load the extension unpacked in Chrome (`chrome://extensions` → Load unpacked → select `dist/`).
  Open options page → confirm "Pro license token" section appears.
  Enter `dev-token-phase2` → click Save → confirm "Saved!" flash.

- [ ] **Step 5: Commit**

  ```bash
  git add src/panel/api/backendClient.ts src/options/options.tsx
  git commit -m "feat: backendClient.ts, Pro token storage, options page token input"
  ```

---

## Task 7: Post-Status Slice — Backend

**Files:**
- Create: `backend/app/services/post_status_service.py`
- Create: `backend/app/routes/post_status.py`
- Create: `backend/tests/test_post_status.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing post-status tests**

  Create `backend/tests/test_post_status.py`:
  ```python
  import pytest
  from unittest.mock import patch, MagicMock


  def _mock_reddit_response(status_code: int, json_body=None):
      mock_resp = MagicMock()
      mock_resp.status_code = status_code
      mock_resp.json.return_value = json_body
      return mock_resp


  VISIBLE_REDDIT_BODY = [
      {
          "data": {
              "children": [
                  {
                      "data": {
                          "id": "abc123",
                          "author": "some_user",
                          "selftext": "hello",
                          "removed_by_category": None,
                          "removed": False,
                      }
                  }
              ]
          }
      },
      {"data": {"children": []}},
  ]

  REMOVED_REDDIT_BODY = [
      {
          "data": {
              "children": [
                  {
                      "data": {
                          "id": "abc123",
                          "author": "[deleted]",
                          "selftext": "",
                          "removed_by_category": "moderator",
                          "removed": True,
                      }
                  }
              ]
          }
      },
      {"data": {"children": []}},
  ]


  @pytest.mark.asyncio
  async def test_post_status_visible(client, auth_headers):
      with patch("app.services.post_status_service.httpx.Client") as mock_client_cls:
          mock_client = MagicMock()
          mock_client.__enter__ = MagicMock(return_value=mock_client)
          mock_client.__exit__ = MagicMock(return_value=False)
          mock_client.get.return_value = _mock_reddit_response(200, VISIBLE_REDDIT_BODY)
          mock_client_cls.return_value = mock_client

          resp = await client.get(
              "/api/v1/post-status?post_id=abc123&subreddit=learnprogramming",
              headers=auth_headers,
          )

      assert resp.status_code == 200
      data = resp.json()
      assert data["status"] == "visible"
      assert data["visible_to_public"] is True
      assert data["reason_hint"] is None
      assert data["post_id"] == "abc123"


  @pytest.mark.asyncio
  async def test_post_status_removed(client, auth_headers):
      with patch("app.services.post_status_service.httpx.Client") as mock_client_cls:
          mock_client = MagicMock()
          mock_client.__enter__ = MagicMock(return_value=mock_client)
          mock_client.__exit__ = MagicMock(return_value=False)
          mock_client.get.return_value = _mock_reddit_response(200, REMOVED_REDDIT_BODY)
          mock_client_cls.return_value = mock_client

          resp = await client.get(
              "/api/v1/post-status?post_id=abc123&subreddit=learnprogramming",
              headers=auth_headers,
          )

      assert resp.status_code == 200
      data = resp.json()
      assert data["status"] == "removed"
      assert data["visible_to_public"] is False


  @pytest.mark.asyncio
  async def test_post_status_404_returns_removed(client, auth_headers):
      with patch("app.services.post_status_service.httpx.Client") as mock_client_cls:
          mock_client = MagicMock()
          mock_client.__enter__ = MagicMock(return_value=mock_client)
          mock_client.__exit__ = MagicMock(return_value=False)
          mock_client.get.return_value = _mock_reddit_response(404)
          mock_client_cls.return_value = mock_client

          resp = await client.get(
              "/api/v1/post-status?post_id=abc123&subreddit=learnprogramming",
              headers=auth_headers,
          )

      assert resp.status_code == 200
      data = resp.json()
      assert data["status"] == "removed"
      assert data["reason_hint"] == "missing_from_listing"


  @pytest.mark.asyncio
  async def test_post_status_requires_auth(client):
      resp = await client.get("/api/v1/post-status?post_id=abc123&subreddit=learnprogramming")
      assert resp.status_code == 401


  @pytest.mark.asyncio
  async def test_post_status_rate_limit(client, auth_headers):
      with patch("app.services.post_status_service.httpx.Client") as mock_client_cls:
          mock_client = MagicMock()
          mock_client.__enter__ = MagicMock(return_value=mock_client)
          mock_client.__exit__ = MagicMock(return_value=False)
          mock_client.get.return_value = _mock_reddit_response(200, VISIBLE_REDDIT_BODY)
          mock_client_cls.return_value = mock_client

          # Use a fresh token to avoid cross-test interference
          headers = {"Authorization": "Bearer test-token-ratelimit-ps"}
          # Monkeypatch settings to accept this token
          from app.config import settings
          original_token = settings.dev_token
          settings.dev_token = "test-token-ratelimit-ps"

          try:
              for _ in range(10):
                  await client.get(
                      "/api/v1/post-status?post_id=abc123&subreddit=learnprogramming",
                      headers=headers,
                  )
              resp = await client.get(
                  "/api/v1/post-status?post_id=abc123&subreddit=learnprogramming",
                  headers=headers,
              )
          finally:
              settings.dev_token = original_token

      assert resp.status_code == 429
      assert resp.json()["detail"]["error"] == "rate_limited"
  ```

- [ ] **Step 2: Run tests — expect FAIL**

  ```bash
  cd backend
  pytest tests/test_post_status.py -v
  ```

  Expected: all FAIL (`404 Not Found` — route doesn't exist yet).

- [ ] **Step 3: Create post_status_service.py**

  Create `backend/app/services/post_status_service.py`:
  ```python
  from datetime import datetime, timezone
  import httpx
  from app.cache import cache
  from app.config import settings
  from app.models import PostStatusResponse


  def check_post_status(post_id: str, subreddit: str) -> PostStatusResponse:
      cache_key = f"post_status:{post_id}"
      cached_data = cache.get(cache_key)
      if cached_data is not None:
          return PostStatusResponse(**cached_data, cached=True)

      result = _fetch_post_status(post_id, subreddit)
      cache.set(cache_key, result.model_dump(exclude={"cached"}), settings.cache_ttl_post_status)
      return result


  def _fetch_post_status(post_id: str, subreddit: str) -> PostStatusResponse:
      checked_at = datetime.now(timezone.utc).isoformat()

      try:
          url = f"https://www.reddit.com/r/{subreddit}/comments/{post_id}.json"
          headers = {"User-Agent": settings.reddit_user_agent}
          with httpx.Client(follow_redirects=True, timeout=10.0) as client:
              resp = client.get(url, headers=headers)

          if resp.status_code == 404:
              return PostStatusResponse(
                  post_id=post_id,
                  subreddit=subreddit,
                  status="removed",
                  visible_to_public=False,
                  reason_hint="missing_from_listing",
                  checked_at=checked_at,
                  cached=False,
              )

          if resp.status_code != 200:
              return PostStatusResponse(
                  post_id=post_id,
                  subreddit=subreddit,
                  status="unknown",
                  visible_to_public=False,
                  reason_hint="fetch_failed",
                  checked_at=checked_at,
                  cached=False,
              )

          data = resp.json()
          children = data[0]["data"]["children"]

          if not children:
              return PostStatusResponse(
                  post_id=post_id,
                  subreddit=subreddit,
                  status="removed",
                  visible_to_public=False,
                  reason_hint="missing_from_listing",
                  checked_at=checked_at,
                  cached=False,
              )

          post = children[0]["data"]
          removed_by = post.get("removed_by_category")
          author_deleted = post.get("author") == "[deleted]"
          has_content = bool(post.get("selftext") or post.get("url"))

          if removed_by is not None or post.get("removed") is True:
              return PostStatusResponse(
                  post_id=post_id,
                  subreddit=subreddit,
                  status="removed",
                  visible_to_public=False,
                  reason_hint="missing_from_listing",
                  checked_at=checked_at,
                  cached=False,
              )

          if author_deleted and not has_content:
              return PostStatusResponse(
                  post_id=post_id,
                  subreddit=subreddit,
                  status="removed",
                  visible_to_public=False,
                  reason_hint="deleted_by_author",
                  checked_at=checked_at,
                  cached=False,
              )

          return PostStatusResponse(
              post_id=post_id,
              subreddit=subreddit,
              status="visible",
              visible_to_public=True,
              reason_hint=None,
              checked_at=checked_at,
              cached=False,
          )

      except httpx.TimeoutException:
          return PostStatusResponse(
              post_id=post_id,
              subreddit=subreddit,
              status="unknown",
              visible_to_public=False,
              reason_hint="fetch_failed",
              checked_at=checked_at,
              cached=False,
          )
      except Exception:
          return PostStatusResponse(
              post_id=post_id,
              subreddit=subreddit,
              status="unknown",
              visible_to_public=False,
              reason_hint="insufficient_signal",
              checked_at=checked_at,
              cached=False,
          )
  ```

- [ ] **Step 4: Create post_status route**

  Create `backend/app/routes/post_status.py`:
  ```python
  from fastapi import APIRouter, Depends
  from app.auth import make_rate_limit_dep
  from app.models import PostStatusResponse
  from app.services.post_status_service import check_post_status

  router = APIRouter()
  _auth = make_rate_limit_dep("post_status", max_requests=10, window_seconds=10)


  @router.get("/post-status", response_model=PostStatusResponse)
  def get_post_status(
      post_id: str,
      subreddit: str,
      token: str = Depends(_auth),
  ) -> PostStatusResponse:
      return check_post_status(post_id, subreddit)
  ```

- [ ] **Step 5: Register route in main.py**

  Update `backend/app/main.py`:
  ```python
  from fastapi import FastAPI
  from fastapi.middleware.cors import CORSMiddleware
  from app.config import settings
  from app.routes import license as license_router
  from app.routes import post_status as post_status_router

  app = FastAPI(title="R3 Backend", version="0.1.0")

  app.add_middleware(
      CORSMiddleware,
      allow_origins=settings.cors_origins.split(","),
      allow_methods=["GET", "POST"],
      allow_headers=["Authorization", "Content-Type"],
  )

  app.include_router(license_router.router, prefix="/api/v1")
  app.include_router(post_status_router.router, prefix="/api/v1")


  @app.get("/health")
  def health():
      return {"status": "ok"}
  ```

- [ ] **Step 6: Run all backend tests — expect PASS**

  ```bash
  cd backend
  pytest -v
  ```

  Expected: all tests PASS.

- [ ] **Step 7: Manual curl verification**

  With the backend running (`uvicorn app.main:app --reload --port 8000`):
  ```bash
  curl -H "Authorization: Bearer dev-token-phase2" \
    "http://localhost:8000/api/v1/post-status?post_id=1abc123&subreddit=learnprogramming"
  ```

  Expected: JSON with `status`, `visible_to_public`, `reason_hint`, `checked_at`.

- [ ] **Step 8: Commit**

  ```bash
  git add backend/app/services/post_status_service.py backend/app/routes/post_status.py backend/app/main.py backend/tests/test_post_status.py
  git commit -m "feat: post-status slice — service, route, rate limiting, tests"
  ```

---

## Task 8: Wire StatusCard to Real API

**Files:**
- Modify: `src/panel/components/StatusCard.tsx`
- Modify: `tests/components/StatusCard.test.tsx`

- [ ] **Step 1: Write failing StatusCard tests**

  Replace `tests/components/StatusCard.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, act } from '@testing-library/react';
  import { StatusCard } from '../../src/panel/components/StatusCard';
  import * as backendClient from '../../src/panel/api/backendClient';

  vi.mock('../../src/panel/api/backendClient', () => ({
    getProToken: vi.fn(),
    fetchPostStatus: vi.fn(),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('StatusCard — no token', () => {
    it('shows Pro overlay when token is missing', async () => {
      vi.mocked(backendClient.getProToken).mockResolvedValue(null);
      await act(async () => {
        render(<StatusCard postId="abc123" username="user1" subreddit="learnprogramming" />);
      });
      expect(screen.getByText('Pro')).toBeInTheDocument();
    });
  });

  describe('StatusCard — loading', () => {
    it('shows loading state while fetching', async () => {
      vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
      vi.mocked(backendClient.fetchPostStatus).mockReturnValue(new Promise(() => {}));
      await act(async () => {
        render(<StatusCard postId="abc123" username="user1" subreddit="learnprogramming" />);
      });
      expect(screen.getByText(/checking/i)).toBeInTheDocument();
    });
  });

  describe('StatusCard — success', () => {
    it('shows visible status', async () => {
      vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
      vi.mocked(backendClient.fetchPostStatus).mockResolvedValue({
        post_id: 'abc123',
        subreddit: 'learnprogramming',
        status: 'visible',
        visible_to_public: true,
        reason_hint: null,
        checked_at: '2026-04-14T12:00:00Z',
        cached: false,
      });
      await act(async () => {
        render(<StatusCard postId="abc123" username="user1" subreddit="learnprogramming" />);
      });
      expect(screen.getByText(/visible/i)).toBeInTheDocument();
    });

    it('shows removed status with reason hint', async () => {
      vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
      vi.mocked(backendClient.fetchPostStatus).mockResolvedValue({
        post_id: 'abc123',
        subreddit: 'learnprogramming',
        status: 'removed',
        visible_to_public: false,
        reason_hint: 'missing_from_listing',
        checked_at: '2026-04-14T12:00:00Z',
        cached: false,
      });
      await act(async () => {
        render(<StatusCard postId="abc123" username="user1" subreddit="learnprogramming" />);
      });
      expect(screen.getByText(/removed/i)).toBeInTheDocument();
    });
  });

  describe('StatusCard — error', () => {
    it('shows service unavailable on 503', async () => {
      vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
      vi.mocked(backendClient.fetchPostStatus).mockRejectedValue(new Error('POST_STATUS_ERROR:503'));
      await act(async () => {
        render(<StatusCard postId="abc123" username="user1" subreddit="learnprogramming" />);
      });
      expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run tests — expect FAIL**

  ```bash
  npm test -- --reporter=verbose tests/components/StatusCard.test.tsx
  ```

  Expected: failures (component still shows mocked UI, not real states).

- [ ] **Step 3: Implement real StatusCard**

  Replace `src/panel/components/StatusCard.tsx`:
  ```tsx
  import { useState, useEffect } from 'react';
  import { getProToken, fetchPostStatus } from '../api/backendClient';
  import type { PostStatusResponse } from '../api/backendClient';

  interface Props {
    postId: string | null;
    username: string | null;
    subreddit: string;
  }

  type State =
    | { type: 'no_token' }
    | { type: 'no_post_id' }
    | { type: 'loading' }
    | { type: 'success'; data: PostStatusResponse }
    | { type: 'rate_limited'; retryAfter: number }
    | { type: 'error'; message: string };

  const REASON_LABELS: Record<string, string> = {
    missing_from_listing: 'Not visible to logged-out users',
    deleted_by_author: 'Deleted by author',
    fetch_failed: 'Could not check visibility',
    insufficient_signal: 'Insufficient data to determine status',
  };

  export function StatusCard({ postId, subreddit }: Props) {
    const [state, setState] = useState<State>({ type: 'loading' });

    useEffect(() => {
      let cancelled = false;

      async function load() {
        const token = await getProToken();
        if (!token) {
          if (!cancelled) setState({ type: 'no_token' });
          return;
        }
        if (!postId) {
          if (!cancelled) setState({ type: 'no_post_id' });
          return;
        }

        setState({ type: 'loading' });

        try {
          const data = await fetchPostStatus(postId, subreddit);
          if (!cancelled) setState({ type: 'success', data });
        } catch (err) {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : '';
          if (msg.startsWith('RATE_LIMITED:')) {
            setState({ type: 'rate_limited', retryAfter: Number(msg.split(':')[1]) });
          } else if (msg === 'UNAUTHORIZED') {
            setState({ type: 'no_token' });
          } else {
            setState({ type: 'error', message: 'Service unavailable. Try again later.' });
          }
        }
      }

      load();
      return () => { cancelled = true; };
    }, [postId, subreddit]);

    return (
      <div className="r3-section">
        <div className="r3-section__heading">Post Visibility</div>
        <StatusBody state={state} />
      </div>
    );
  }

  function StatusBody({ state }: { state: State }) {
    if (state.type === 'no_token') {
      return (
        <div className="r3-pro-card">
          <div className="r3-pro-overlay">
            <span className="r3-pro-badge">Pro</span>
            <span className="r3-pro-cta">Unlock to check if your post is visible</span>
          </div>
        </div>
      );
    }

    if (state.type === 'no_post_id') {
      return (
        <div style={{ padding: '8px 0', fontSize: 13, color: '#7c7c7c' }}>
          Submit a post to check its visibility.
        </div>
      );
    }

    if (state.type === 'loading') {
      return (
        <div style={{ padding: '8px 0', fontSize: 13, color: '#7c7c7c' }}>
          Checking visibility…
        </div>
      );
    }

    if (state.type === 'rate_limited') {
      return (
        <div style={{ padding: '8px 0', fontSize: 13, color: '#7c7c7c' }}>
          Too many checks. Try again in {state.retryAfter}s.
        </div>
      );
    }

    if (state.type === 'error') {
      return (
        <div style={{ padding: '8px 0', fontSize: 13, color: '#cc3300' }}>
          {state.message}
        </div>
      );
    }

    const { data } = state;
    const statusColor = data.status === 'visible' ? '#4caf50' : data.status === 'removed' ? '#cc3300' : '#888';

    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: statusColor, textTransform: 'capitalize' }}>
            {data.status}
          </span>
          {data.cached && (
            <span style={{ fontSize: 11, color: '#aaa' }}>cached</span>
          )}
        </div>
        {data.reason_hint && (
          <div style={{ fontSize: 12, color: '#7c7c7c', marginTop: 4 }}>
            {REASON_LABELS[data.reason_hint] ?? data.reason_hint}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
          Checked {new Date(data.checked_at).toLocaleTimeString()}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Run tests — expect PASS**

  ```bash
  npm test -- --reporter=verbose tests/components/StatusCard.test.tsx
  ```

  Expected: all tests PASS.

- [ ] **Step 5: Build and manual verify in Chrome**

  ```bash
  npm run build
  ```

  Load extension unpacked. Navigate to a Reddit post URL. Confirm StatusCard shows "Checking visibility…" then a real result (or Pro overlay if token not set).

  Set token `dev-token-phase2` in options. Reload the tab. Confirm the check runs against `http://localhost:8000`.

- [ ] **Step 6: Commit**

  ```bash
  git add src/panel/components/StatusCard.tsx tests/components/StatusCard.test.tsx
  git commit -m "feat: wire StatusCard to post-status API, loading/error/success states"
  ```

---

## Task 9: PRAW Client

**Files:**
- Create: `backend/app/praw_client.py`
- Test: `backend/tests/test_praw_client.py`

- [ ] **Step 1: Write failing test**

  Create `backend/tests/test_praw_client.py`:
  ```python
  import pytest
  from unittest.mock import patch, MagicMock
  from app.praw_client import get_reddit_client


  def test_returns_singleton():
      """get_reddit_client returns the same instance on repeated calls."""
      with patch("app.praw_client.praw.Reddit") as mock_reddit_cls:
          mock_reddit_cls.return_value = MagicMock()
          # Reset the singleton first
          import app.praw_client as pc
          pc._reddit = None

          c1 = get_reddit_client()
          c2 = get_reddit_client()

      assert c1 is c2
      assert mock_reddit_cls.call_count == 1


  def test_uses_config_credentials():
      with patch("app.praw_client.praw.Reddit") as mock_reddit_cls:
          import app.praw_client as pc
          pc._reddit = None
          get_reddit_client()

      _, kwargs = mock_reddit_cls.call_args
      assert kwargs["client_id"] == "test-client-id"
      assert kwargs["client_secret"] == "test-client-secret"
  ```

- [ ] **Step 2: Run tests — expect FAIL**

  ```bash
  cd backend
  pytest tests/test_praw_client.py -v
  ```

  Expected: `ImportError` — module doesn't exist yet.

- [ ] **Step 3: Create praw_client.py**

  Create `backend/app/praw_client.py`:
  ```python
  import praw
  from app.config import settings

  _reddit: praw.Reddit | None = None


  def get_reddit_client() -> praw.Reddit:
      """Return the module-level PRAW read-only client. Initializes on first call."""
      global _reddit
      if _reddit is None:
          _reddit = praw.Reddit(
              client_id=settings.reddit_client_id,
              client_secret=settings.reddit_client_secret,
              user_agent=settings.reddit_user_agent,
          )
      return _reddit
  ```

- [ ] **Step 4: Run tests — expect PASS**

  ```bash
  cd backend
  pytest tests/test_praw_client.py -v
  ```

  Expected: both PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/app/praw_client.py backend/tests/test_praw_client.py
  git commit -m "feat: PRAW client singleton"
  ```

---

## Task 10: Risk Slice — Backend

**Files:**
- Create: `backend/app/services/risk_service.py`
- Create: `backend/app/routes/risk.py`
- Create: `backend/tests/test_risk.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing risk tests**

  Create `backend/tests/test_risk.py`:
  ```python
  import pytest
  from unittest.mock import patch, MagicMock
  from datetime import datetime, timezone, timedelta


  def _make_mock_redditor(karma=500, created_days_ago=120):
      mock_user = MagicMock()
      mock_user.id = "abc"
      mock_user.link_karma = karma // 2
      mock_user.comment_karma = karma // 2
      created_utc = (datetime.now(timezone.utc) - timedelta(days=created_days_ago)).timestamp()
      mock_user.created_utc = created_utc
      return mock_user


  def _make_mock_subreddit(submission_type="any"):
      mock_sub = MagicMock()
      mock_sub.submission_type = submission_type
      return mock_sub


  @pytest.mark.asyncio
  async def test_risk_returns_valid_response(client, auth_headers):
      with patch("app.services.risk_service.get_reddit_client") as mock_get_client:
          mock_reddit = MagicMock()
          mock_reddit.redditor.return_value = _make_mock_redditor()
          mock_reddit.subreddit.return_value = _make_mock_subreddit()
          # Wiki access denied (common case)
          mock_reddit.subreddit.return_value.wiki.__getitem__.side_effect = Exception("forbidden")
          mock_get_client.return_value = mock_reddit

          resp = await client.post(
              "/api/v1/risk",
              json={"subreddit": "learnprogramming", "username": "testuser", "post_type": "text"},
              headers=auth_headers,
          )

      assert resp.status_code == 200
      data = resp.json()
      assert data["risk_level"] in ("low", "medium", "high")
      assert data["confidence"] in ("low", "medium", "high")
      assert isinstance(data["factors"], list)
      assert "recommendation" in data
      assert "cached" in data


  @pytest.mark.asyncio
  async def test_risk_degrades_gracefully_when_user_unavailable(client, auth_headers):
      """If PRAW can't fetch user data, still return a response with low confidence."""
      with patch("app.services.risk_service.get_reddit_client") as mock_get_client:
          mock_reddit = MagicMock()
          mock_reddit.redditor.return_value.id  # accessing .id raises
          mock_reddit.redditor.return_value.__getattr__ = MagicMock(side_effect=Exception("not found"))
          mock_reddit.subreddit.return_value = _make_mock_subreddit()
          mock_reddit.subreddit.return_value.wiki.__getitem__.side_effect = Exception("forbidden")
          mock_get_client.return_value = mock_reddit

          resp = await client.post(
              "/api/v1/risk",
              json={"subreddit": "learnprogramming", "username": "ghost_user", "post_type": "text"},
              headers=auth_headers,
          )

      assert resp.status_code == 200
      data = resp.json()
      assert data["confidence"] == "low"


  @pytest.mark.asyncio
  async def test_risk_requires_auth(client):
      resp = await client.post(
          "/api/v1/risk",
          json={"subreddit": "learnprogramming", "username": "testuser", "post_type": "text"},
      )
      assert resp.status_code == 401


  @pytest.mark.asyncio
  async def test_risk_rate_limit(client, auth_headers):
      with patch("app.services.risk_service.get_reddit_client") as mock_get_client:
          mock_reddit = MagicMock()
          mock_reddit.redditor.return_value = _make_mock_redditor()
          mock_reddit.subreddit.return_value = _make_mock_subreddit()
          mock_reddit.subreddit.return_value.wiki.__getitem__.side_effect = Exception("forbidden")
          mock_get_client.return_value = mock_reddit

          from app.config import settings
          original_token = settings.dev_token
          settings.dev_token = "test-token-ratelimit-risk"
          headers = {"Authorization": "Bearer test-token-ratelimit-risk"}

          try:
              for _ in range(5):
                  await client.post(
                      "/api/v1/risk",
                      json={"subreddit": "learnprogramming", "username": "u", "post_type": "text"},
                      headers=headers,
                  )
              resp = await client.post(
                  "/api/v1/risk",
                  json={"subreddit": "learnprogramming", "username": "u", "post_type": "text"},
                  headers=headers,
              )
          finally:
              settings.dev_token = original_token

      assert resp.status_code == 429
  ```

- [ ] **Step 2: Run tests — expect FAIL**

  ```bash
  cd backend
  pytest tests/test_risk.py -v
  ```

  Expected: FAIL (route doesn't exist).

- [ ] **Step 3: Create risk_service.py**

  Create `backend/app/services/risk_service.py`:
  ```python
  import re
  from datetime import datetime, timezone
  from app.cache import cache
  from app.config import settings
  from app.models import RiskResponse, RiskFactor
  from app.praw_client import get_reddit_client


  def check_risk(subreddit: str, username: str, post_type: str) -> RiskResponse:
      cache_key = f"risk:{subreddit}:{username}:{post_type}"
      cached_data = cache.get(cache_key)
      if cached_data is not None:
          return RiskResponse(**cached_data, cached=True)

      result = _compute_risk(subreddit, username, post_type)
      cache.set(cache_key, result.model_dump(exclude={"cached"}), settings.cache_ttl_risk)
      return result


  def _compute_risk(subreddit: str, username: str, post_type: str) -> RiskResponse:
      reddit = get_reddit_client()
      factors: list[RiskFactor] = []
      signals_available = 0
      signals_total = 0

      sub_meta = _get_subreddit_meta(reddit, subreddit)
      user_data = _get_user_data(reddit, username)

      # ── Karma factor ──────────────────────────────────────────────────────────
      karma_threshold = sub_meta.get("karma_threshold") if sub_meta else None
      if karma_threshold is not None:
          signals_total += 1
          if user_data:
              signals_available += 1
              user_karma = user_data["karma"]
              if user_karma < karma_threshold:
                  factors.append(RiskFactor(
                      type="karma",
                      impact="high",
                      message=f"User karma ({user_karma}) may be below the subreddit threshold (~{karma_threshold}).",
                  ))

      # ── Account age factor ────────────────────────────────────────────────────
      age_threshold = sub_meta.get("account_age_days") if sub_meta else None
      if age_threshold is not None:
          signals_total += 1
          if user_data:
              signals_available += 1
              actual_age = user_data["account_age_days"]
              if actual_age < age_threshold:
                  factors.append(RiskFactor(
                      type="account_age",
                      impact="high",
                      message=f"Account age ({actual_age} days) may be below the subreddit threshold (~{age_threshold} days).",
                  ))

      # ── Flair factor ──────────────────────────────────────────────────────────
      if sub_meta and sub_meta.get("flair_required"):
          signals_total += 1
          signals_available += 1
          factors.append(RiskFactor(
              type="flair_required",
              impact="medium",
              message="This subreddit requires post flair. Make sure to select flair before posting.",
          ))

      # ── Derive risk level ─────────────────────────────────────────────────────
      high_count = sum(1 for f in factors if f.impact == "high")
      med_count = sum(1 for f in factors if f.impact == "medium")

      if high_count >= 2:
          risk_level = "high"
      elif high_count >= 1 or med_count >= 2:
          risk_level = "medium"
      else:
          risk_level = "low"

      # ── Derive confidence ─────────────────────────────────────────────────────
      if signals_total == 0:
          confidence = "low"
      elif signals_available / signals_total >= 0.7:
          confidence = "high"
      elif signals_available / signals_total >= 0.4:
          confidence = "medium"
      else:
          confidence = "low"

      # ── Recommendation ────────────────────────────────────────────────────────
      if risk_level == "high":
          rec = "High removal risk. Address the flagged factors before posting."
      elif risk_level == "medium":
          rec = "Moderate removal risk. Review flagged factors before posting."
      else:
          rec = "Low removal risk. Your post appears likely to meet this subreddit's requirements."

      if confidence == "low":
          rec += " (Low confidence — limited subreddit data available.)"

      return RiskResponse(
          subreddit=subreddit,
          username=username,
          risk_level=risk_level,
          confidence=confidence,
          factors=factors,
          recommendation=rec,
          cached=False,
      )


  def _get_subreddit_meta(reddit, subreddit: str) -> dict | None:
      cache_key = f"subreddit_meta:{subreddit}"
      cached = cache.get(cache_key)
      if cached is not None:
          return cached

      meta: dict = {}

      try:
          sub = reddit.subreddit(subreddit)
          meta["flair_required"] = getattr(sub, "link_flair_required", False)
      except Exception:
          pass  # degrade gracefully

      try:
          wiki_page = reddit.subreddit(subreddit).wiki["automoderator"]
          thresholds = _parse_automod_thresholds(wiki_page.content_md)
          meta.update(thresholds)
      except Exception:
          pass  # automod not accessible — that's fine

      cache.set(cache_key, meta, settings.cache_ttl_subreddit_meta)
      return meta


  def _get_user_data(reddit, username: str) -> dict | None:
      try:
          redditor = reddit.redditor(username)
          _ = redditor.id  # force fetch; raises if user doesn't exist
          age_days = (
              datetime.now(timezone.utc)
              - datetime.fromtimestamp(redditor.created_utc, timezone.utc)
          ).days
          return {
              "karma": redditor.link_karma + redditor.comment_karma,
              "account_age_days": age_days,
          }
      except Exception:
          return None  # degrade gracefully


  def _parse_automod_thresholds(automod_text: str) -> dict:
      """Extract karma/age thresholds from automod config YAML text."""
      thresholds: dict = {}

      karma_match = re.search(
          r"(?:combined_karma|link_karma|comment_karma)\s*[<>]?\s*(\d+)",
          automod_text,
      )
      if karma_match:
          thresholds["karma_threshold"] = int(karma_match.group(1))

      age_match = re.search(
          r"account_age\s*[<>]?\s*(\d+)\s*(?:day|days)",
          automod_text,
      )
      if age_match:
          thresholds["account_age_days"] = int(age_match.group(1))

      return thresholds
  ```

- [ ] **Step 4: Create risk route**

  Create `backend/app/routes/risk.py`:
  ```python
  from fastapi import APIRouter, Depends
  from app.auth import make_rate_limit_dep
  from app.models import RiskRequest, RiskResponse
  from app.services.risk_service import check_risk

  router = APIRouter()
  _auth = make_rate_limit_dep("risk", max_requests=5, window_seconds=10)


  @router.post("/risk", response_model=RiskResponse)
  def post_risk(
      body: RiskRequest,
      token: str = Depends(_auth),
  ) -> RiskResponse:
      return check_risk(body.subreddit, body.username, body.post_type)
  ```

- [ ] **Step 5: Register risk route in main.py**

  Update `backend/app/main.py`:
  ```python
  from fastapi import FastAPI
  from fastapi.middleware.cors import CORSMiddleware
  from app.config import settings
  from app.routes import license as license_router
  from app.routes import post_status as post_status_router
  from app.routes import risk as risk_router

  app = FastAPI(title="R3 Backend", version="0.1.0")

  app.add_middleware(
      CORSMiddleware,
      allow_origins=settings.cors_origins.split(","),
      allow_methods=["GET", "POST"],
      allow_headers=["Authorization", "Content-Type"],
  )

  app.include_router(license_router.router, prefix="/api/v1")
  app.include_router(post_status_router.router, prefix="/api/v1")
  app.include_router(risk_router.router, prefix="/api/v1")


  @app.get("/health")
  def health():
      return {"status": "ok"}
  ```

- [ ] **Step 6: Run all backend tests — expect PASS**

  ```bash
  cd backend
  pytest -v
  ```

  Expected: all tests PASS.

- [ ] **Step 7: Manual curl test**

  ```bash
  curl -X POST http://localhost:8000/api/v1/risk \
    -H "Authorization: Bearer dev-token-phase2" \
    -H "Content-Type: application/json" \
    -d '{"subreddit": "learnprogramming", "username": "your_reddit_username", "post_type": "text"}'
  ```

  Expected: JSON with `risk_level`, `confidence`, `factors`, `recommendation`.

- [ ] **Step 8: Commit**

  ```bash
  git add backend/app/services/risk_service.py backend/app/routes/risk.py backend/app/main.py backend/tests/test_risk.py
  git commit -m "feat: risk slice — PRAW scoring, graceful degradation, rate limiting, tests"
  ```

---

## Task 11: Wire RiskCard to Real API

**Files:**
- Modify: `src/panel/components/RiskCard.tsx`
- Modify: `tests/components/RiskCard.test.tsx`

- [ ] **Step 1: Write failing RiskCard tests**

  Replace `tests/components/RiskCard.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, act } from '@testing-library/react';
  import { RiskCard } from '../../src/panel/components/RiskCard';
  import * as backendClient from '../../src/panel/api/backendClient';

  vi.mock('../../src/panel/api/backendClient', () => ({
    getProToken: vi.fn(),
    fetchRisk: vi.fn(),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RiskCard — no token', () => {
    it('shows Pro overlay when token is missing', async () => {
      vi.mocked(backendClient.getProToken).mockResolvedValue(null);
      await act(async () => {
        render(<RiskCard subreddit="javascript" username="testuser" />);
      });
      expect(screen.getByText('Pro')).toBeInTheDocument();
    });

    it('shows Pro overlay when username is null', async () => {
      vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
      await act(async () => {
        render(<RiskCard subreddit="javascript" username={null} />);
      });
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    });
  });

  describe('RiskCard — loading', () => {
    it('shows loading state while fetching', async () => {
      vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
      vi.mocked(backendClient.fetchRisk).mockReturnValue(new Promise(() => {}));
      await act(async () => {
        render(<RiskCard subreddit="javascript" username="testuser" />);
      });
      expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
    });
  });

  describe('RiskCard — success', () => {
    it('shows low risk level', async () => {
      vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
      vi.mocked(backendClient.fetchRisk).mockResolvedValue({
        subreddit: 'javascript',
        username: 'testuser',
        risk_level: 'low',
        confidence: 'high',
        factors: [],
        recommendation: 'Low removal risk.',
        cached: false,
      });
      await act(async () => {
        render(<RiskCard subreddit="javascript" username="testuser" />);
      });
      expect(screen.getByText(/low/i)).toBeInTheDocument();
    });

    it('shows high risk with factors', async () => {
      vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
      vi.mocked(backendClient.fetchRisk).mockResolvedValue({
        subreddit: 'javascript',
        username: 'newuser',
        risk_level: 'high',
        confidence: 'medium',
        factors: [
          { type: 'karma', impact: 'high', message: 'Karma too low.' },
        ],
        recommendation: 'High removal risk.',
        cached: false,
      });
      await act(async () => {
        render(<RiskCard subreddit="javascript" username="newuser" />);
      });
      expect(screen.getByText(/high/i)).toBeInTheDocument();
      expect(screen.getByText(/karma too low/i)).toBeInTheDocument();
    });
  });

  describe('RiskCard — error', () => {
    it('shows error message on service failure', async () => {
      vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
      vi.mocked(backendClient.fetchRisk).mockRejectedValue(new Error('RISK_ERROR:503'));
      await act(async () => {
        render(<RiskCard subreddit="javascript" username="testuser" />);
      });
      expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run tests — expect FAIL**

  ```bash
  npm test -- --reporter=verbose tests/components/RiskCard.test.tsx
  ```

  Expected: failures (component still shows mocked UI).

- [ ] **Step 3: Implement real RiskCard**

  Replace `src/panel/components/RiskCard.tsx`:
  ```tsx
  import { useState, useEffect } from 'react';
  import { getProToken, fetchRisk } from '../api/backendClient';
  import type { RiskResponse, RiskFactor } from '../api/backendClient';

  interface Props {
    subreddit: string;
    username: string | null;
  }

  type State =
    | { type: 'no_token' }
    | { type: 'no_username' }
    | { type: 'loading' }
    | { type: 'success'; data: RiskResponse }
    | { type: 'rate_limited'; retryAfter: number }
    | { type: 'error'; message: string };

  const RISK_COLORS = { low: '#4caf50', medium: '#ff9800', high: '#cc3300' };
  const IMPACT_COLORS = { high: '#cc3300', medium: '#ff9800', low: '#888' };

  export function RiskCard({ subreddit, username }: Props) {
    const [state, setState] = useState<State>({ type: 'loading' });

    useEffect(() => {
      let cancelled = false;

      async function load() {
        const token = await getProToken();
        if (!token) {
          if (!cancelled) setState({ type: 'no_token' });
          return;
        }
        if (!username) {
          if (!cancelled) setState({ type: 'no_username' });
          return;
        }

        setState({ type: 'loading' });

        try {
          const data = await fetchRisk(subreddit, username);
          if (!cancelled) setState({ type: 'success', data });
        } catch (err) {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : '';
          if (msg.startsWith('RATE_LIMITED:')) {
            setState({ type: 'rate_limited', retryAfter: Number(msg.split(':')[1]) });
          } else if (msg === 'UNAUTHORIZED') {
            setState({ type: 'no_token' });
          } else {
            setState({ type: 'error', message: 'Service unavailable. Try again later.' });
          }
        }
      }

      load();
      return () => { cancelled = true; };
    }, [subreddit, username]);

    return (
      <div className="r3-section">
        <div className="r3-section__heading">Posting Risk</div>
        <RiskBody state={state} />
      </div>
    );
  }

  function RiskBody({ state }: { state: State }) {
    if (state.type === 'no_token') {
      return (
        <div className="r3-pro-card">
          <div className="r3-pro-overlay">
            <span className="r3-pro-badge">Pro</span>
            <span className="r3-pro-cta">Unlock to see your real risk score</span>
          </div>
        </div>
      );
    }

    if (state.type === 'no_username') {
      return (
        <div style={{ padding: '8px 0', fontSize: 13, color: '#7c7c7c' }}>
          Sign in to Reddit to check your posting risk.
        </div>
      );
    }

    if (state.type === 'loading') {
      return (
        <div style={{ padding: '8px 0', fontSize: 13, color: '#7c7c7c' }}>
          Analyzing risk…
        </div>
      );
    }

    if (state.type === 'rate_limited') {
      return (
        <div style={{ padding: '8px 0', fontSize: 13, color: '#7c7c7c' }}>
          Too many checks. Try again in {state.retryAfter}s.
        </div>
      );
    }

    if (state.type === 'error') {
      return (
        <div style={{ padding: '8px 0', fontSize: 13, color: '#cc3300' }}>
          {state.message}
        </div>
      );
    }

    const { data } = state;

    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span
            className={`r3-risk-level r3-risk-level--${data.risk_level}`}
            style={{ color: RISK_COLORS[data.risk_level] }}
          >
            {data.risk_level.charAt(0).toUpperCase() + data.risk_level.slice(1)}
          </span>
          <span style={{ fontSize: 11, color: '#aaa' }}>
            {data.confidence} confidence
          </span>
          {data.cached && <span style={{ fontSize: 11, color: '#aaa' }}>cached</span>}
        </div>

        {data.factors.length > 0 && (
          <ul style={{ fontSize: 12, color: '#7c7c7c', marginTop: 4, paddingLeft: 16 }}>
            {data.factors.map((f: RiskFactor, i: number) => (
              <li key={i} style={{ marginBottom: 2, color: IMPACT_COLORS[f.impact] }}>
                {f.message}
              </li>
            ))}
          </ul>
        )}

        <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
          {data.recommendation}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Run tests — expect PASS**

  ```bash
  npm test -- --reporter=verbose tests/components/RiskCard.test.tsx
  ```

  Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

  ```bash
  npm test
  ```

  Expected: all tests PASS (no regressions).

- [ ] **Step 6: Build and manual verify in Chrome**

  ```bash
  npm run build
  ```

  Load extension unpacked. With backend running and `dev-token-phase2` set in options:
  - Navigate to a subreddit → RiskCard should show "Analyzing risk…" then a real result
  - Navigate to a post page → StatusCard should show real visibility status

- [ ] **Step 7: Commit**

  ```bash
  git add src/panel/components/RiskCard.tsx tests/components/RiskCard.test.tsx
  git commit -m "feat: wire RiskCard to risk API, loading/error/success states"
  ```

---

## Task 12: Deployment Setup

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/fly.toml`
- Create: `backend/README.md`

- [ ] **Step 1: Create Dockerfile**

  Create `backend/Dockerfile`:
  ```dockerfile
  FROM python:3.12-slim

  WORKDIR /app

  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt

  COPY app/ ./app/

  EXPOSE 8000

  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```

- [ ] **Step 2: Create fly.toml**

  Create `backend/fly.toml`:
  ```toml
  app = "r3-backend"
  primary_region = "lax"

  [build]

  [http_service]
    internal_port = 8000
    force_https = true
    auto_stop_machines = true
    auto_start_machines = true
    min_machines_running = 0

  [[vm]]
    memory = "256mb"
    cpu_kind = "shared"
    cpus = 1
  ```

- [ ] **Step 3: Create README.md**

  Create `backend/README.md`:
  ```markdown
  # R3 Backend

  FastAPI + PRAW backend for R3 Chrome extension Pro features.

  ## Prerequisites

  - Python 3.12+
  - A Reddit "script" app (see Task 1 in implementation plan)

  ## Local setup

  ```bash
  python -m venv .venv
  # Windows:
  .venv\Scripts\activate
  # macOS/Linux:
  source .venv/bin/activate

  pip install -r requirements.txt
  cp .env.example .env
  # Edit .env — add your REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET
  ```

  ## Run

  ```bash
  uvicorn app.main:app --reload --port 8000
  ```

  Server starts at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

  ## Test

  ```bash
  pytest -v
  ```

  ## Environment variables

  | Variable | Required | Default | Description |
  |---|---|---|---|
  | `REDDIT_CLIENT_ID` | yes | — | Reddit OAuth app client ID |
  | `REDDIT_CLIENT_SECRET` | yes | — | Reddit OAuth app secret |
  | `REDDIT_USER_AGENT` | no | `r3-backend/0.1` | PRAW user agent |
  | `LICENSE_MODE` | no | `stub` | `stub` accepts `DEV_TOKEN`; `live` validates via ExtensionPay |
  | `DEV_TOKEN` | no | `dev-token-phase2` | Token accepted in stub mode |

  ## curl examples

  ```bash
  # Health
  curl http://localhost:8000/health

  # License
  curl -H "Authorization: Bearer dev-token-phase2" http://localhost:8000/api/v1/license

  # Post status
  curl -H "Authorization: Bearer dev-token-phase2" \
    "http://localhost:8000/api/v1/post-status?post_id=abc123&subreddit=learnprogramming"

  # Risk
  curl -X POST http://localhost:8000/api/v1/risk \
    -H "Authorization: Bearer dev-token-phase2" \
    -H "Content-Type: application/json" \
    -d '{"subreddit": "learnprogramming", "username": "your_username", "post_type": "text"}'
  ```

  ## Deploy to Fly.io

  ```bash
  # Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
  fly auth login
  fly launch --no-deploy  # sets up app, use existing fly.toml
  fly secrets set REDDIT_CLIENT_ID=... REDDIT_CLIENT_SECRET=... LICENSE_MODE=stub DEV_TOKEN=dev-token-phase2
  fly deploy
  ```

  After deploy, update `VITE_BACKEND_URL` in the extension build to point to the Fly.io URL.
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add backend/Dockerfile backend/fly.toml backend/README.md
  git commit -m "feat: Dockerfile, fly.toml, backend README with setup and deploy instructions"
  ```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `backend/` monorepo structure with service layer + config.py | Task 2 |
| Vertical slice order: license → post-status → risk | Tasks 5, 7, 10 |
| `LICENSE_MODE=stub` with `DEV_TOKEN` | Tasks 2, 4, 5 |
| License response with `features` flags | Task 5 |
| Post-status with `reason_hint` | Task 7 |
| Risk with `confidence` + structured `factors` | Task 10 |
| Graceful degradation — never fail on missing Reddit data | Task 10, `risk_service.py` |
| Rate limiting (post-status 10/10s, risk 5/10s) | Tasks 7, 10 |
| Extension guest-mode fallback when token missing | Tasks 8, 11 |
| Cache keys explicit, TTLs from config | Tasks 3, 7, 10 |
| `backendClient.ts` with typed wrappers | Task 6 |
| Options page token input | Task 6 |
| `post_type` as enum | Task 4 (`models.py`) |
| Dockerfile + fly.toml | Task 12 |
| README with curl examples | Task 12 |

All spec requirements covered. No placeholders. Types consistent across tasks (e.g., `RiskFactor` defined in `models.py` Task 4 and used in `risk_service.py` Task 10 and `backendClient.ts` Task 6).
