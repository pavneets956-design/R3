# ExtensionPay Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire ExtensionPay into R3 so free users see a real risk score teaser and a locked StatusCard, while Pro users ($5 one-time) get full risk breakdown and post-removal detection via server-validated licenses.

**Architecture:** Extension installs ExtensionPay SDK; service worker registers `onPaid` at top level and stores the user's email in `chrome.storage.local` as the Pro bearer token. All Pro API calls send `Authorization: Bearer <email>` over TLS; the backend middleware validates against ExtensionPay's API (15-min cache for paid=true, no cache for paid=false, 503 on outage). A new unauthenticated `/api/v1/risk-summary` endpoint serves the free-tier risk score (level + score only, no factors). The panel is gated via `LicenseContext` which reads storage on mount and listens for `LICENSE_UPDATED` messages from the SW.

**Tech Stack:** TypeScript/React MV3, `extensionpay` npm package, FastAPI/Python, `httpx` (already installed), existing `TTLCache` in `backend/app/cache.py`

---

## File Map

### Created
- `src/panel/contexts/LicenseContext.tsx` — React context: `{ paid, email, openPaymentPage }`
- `src/panel/components/UpgradeCTA.tsx` — Footer upgrade bar (shown when free)
- `src/panel/components/ProLock.tsx` — Reusable blurred lock overlay for Pro fields
- `src/panel/components/Toast.tsx` — "Pro unlocked" toast notification
- `backend/app/services/license_service.py` — ExtensionPay API validation + cache (replaces stub)
- `backend/app/routes/risk_summary.py` — `GET /api/v1/risk-summary` (no auth)
- `tests/components/LicenseContext.test.tsx`
- `tests/components/UpgradeCTA.test.tsx`
- `backend/tests/test_license_service.py`
- `backend/tests/test_risk_summary.py`

### Modified
- `src/background/index.ts` — Add ExtPay init, `startBackground()`, `onPaid` at top level
- `src/panel/api/backendClient.ts` — Add `fetchRiskSummary()`, remove `fetchLicense()`
- `src/panel/components/RiskCard.tsx` — Free tier (summary) vs Pro tier (full), blur breakdown
- `src/panel/components/StatusCard.tsx` — Free tier (static teaser) vs Pro tier (existing)
- `src/panel/components/PanelFooter.tsx` — Add `<UpgradeCTA />` when free
- `src/panel/main.tsx` — Wrap app in `<LicenseProvider>`
- `src/shared/types.ts` — Add `RiskSummaryResponse`, `LicenseState`
- `backend/app/auth.py` — Replace stub with ExtensionPay email validation
- `backend/app/config.py` — Add `extensionpay_secret_key`, `license_mode = "extensionpay"`
- `backend/app/main.py` — Register risk_summary router, remove license router
- `backend/app/routes/license.py` — Delete (replaced by middleware)
- `manifest.json` — No change needed (extensionpay installs as npm package)
- `tests/components/RiskCard.test.tsx` — Add free-tier tests
- `tests/components/StatusCard.test.tsx` — Add free-tier teaser tests
- `backend/tests/test_auth.py` — Update for ExtensionPay validation

---

## Task 1: Backend config + ExtensionPay secret

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/.env.example` (if it exists, else create)

- [ ] **Step 1: Read current config**

Read `backend/app/config.py` to see current settings structure.

- [ ] **Step 2: Add ExtensionPay config fields**

In `backend/app/config.py`, add to the `Settings` class:

```python
extensionpay_secret_key: str = ""          # set in .env, never commit
license_mode: str = "stub"                  # "stub" | "extensionpay"
```

- [ ] **Step 3: Add to .env.example**

In `backend/.env.example` (create if missing):

```
EXTENSIONPAY_SECRET_KEY=your_key_here
LICENSE_MODE=extensionpay
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/config.py backend/.env.example
git commit -m "feat: add ExtensionPay config fields"
```

---

## Task 2: Backend — ExtensionPay license validation service

**Files:**
- Modify: `backend/app/services/license_service.py` (replace stub)
- Create: `backend/tests/test_license_service.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_license_service.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.license_service import validate_license


@pytest.mark.asyncio
async def test_paid_email_returns_true():
    """ExtensionPay says paid=true → returns True, caches 15min"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"paid": True}

    with patch("app.services.license_service.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        result = await validate_license("user@example.com")
        assert result is True


@pytest.mark.asyncio
async def test_unpaid_email_returns_false():
    """ExtensionPay says paid=false → returns False, not cached"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"paid": False}

    with patch("app.services.license_service.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        result = await validate_license("free@example.com")
        assert result is False


@pytest.mark.asyncio
async def test_extensionpay_down_raises():
    """ExtensionPay API unreachable → raises LicenseServiceError"""
    import httpx
    from app.services.license_service import LicenseServiceError

    with patch("app.services.license_service.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("timeout"))
        mock_client_cls.return_value = mock_client

        with pytest.raises(LicenseServiceError):
            await validate_license("user@example.com")


@pytest.mark.asyncio
async def test_stub_mode_always_valid():
    """In stub mode, any non-empty email is treated as paid"""
    from app.services.license_service import validate_license_stub
    assert await validate_license_stub("anyone@example.com") is True


@pytest.mark.asyncio
async def test_empty_email_returns_false():
    """Empty email → False without calling ExtensionPay"""
    result = await validate_license("")
    assert result is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_license_service.py -v
```
Expected: `ModuleNotFoundError` or `ImportError` — `validate_license` doesn't exist yet.

- [ ] **Step 3: Replace the stub license service**

Rewrite `backend/app/services/license_service.py`:

```python
import httpx
from app.cache import cache
from app.config import settings

EXTENSIONPAY_API = "https://extensionpay.com/api/users"
LICENSE_CACHE_TTL = 900  # 15 minutes for paid=true only


class LicenseServiceError(Exception):
    """Raised when ExtensionPay API is unreachable."""


async def validate_license(email: str) -> bool:
    """
    Returns True if the email has a paid ExtensionPay license.
    Caches paid=True results for 15 minutes.
    paid=False is never cached (new paying users must not wait).
    Raises LicenseServiceError if ExtensionPay is unreachable.
    """
    if not email:
        return False

    if settings.license_mode == "stub":
        return await validate_license_stub(email)

    cache_key = f"license:{email}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{EXTENSIONPAY_API}/{email}",
                headers={"Authorization": f"Basic {settings.extensionpay_secret_key}"},
            )
    except (httpx.ConnectError, httpx.TimeoutException, httpx.RequestError) as exc:
        raise LicenseServiceError(f"ExtensionPay unreachable: {exc}") from exc

    if resp.status_code != 200:
        return False

    paid = bool(resp.json().get("paid", False))
    if paid:
        cache.set(cache_key, True, LICENSE_CACHE_TTL)
    # paid=False: intentionally not cached
    return paid


async def validate_license_stub(email: str) -> bool:
    """Stub mode: any non-empty email is treated as paid (dev only)."""
    return bool(email)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_license_service.py -v
```
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/license_service.py backend/tests/test_license_service.py
git commit -m "feat: ExtensionPay license validation service with 15min cache"
```

---

## Task 3: Backend — Replace auth stub with ExtensionPay middleware

**Files:**
- Modify: `backend/app/auth.py`
- Modify: `backend/tests/test_auth.py` (read first)

- [ ] **Step 1: Read current test_auth.py**

Read `backend/tests/test_auth.py` to understand existing test structure.

- [ ] **Step 2: Update auth.py**

Replace `backend/app/auth.py`:

```python
from typing import Optional
from fastapi import Header, HTTPException
from app.config import settings
from app.cache import cache, rate_limiter
from app.services.license_service import validate_license, LicenseServiceError


async def require_token(authorization: Optional[str] = Header(default=None)) -> str:
    """
    Validates Authorization: Bearer <email> header against ExtensionPay.
    Returns the email (used as rate-limit key).
    Raises 401 if missing/invalid, 403 if unpaid, 503 if ExtensionPay is down.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})

    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})

    try:
        paid = await validate_license(token)
    except LicenseServiceError:
        raise HTTPException(status_code=503, detail={"error": "license_service_unavailable"})

    if not paid:
        raise HTTPException(status_code=403, detail={"error": "pro_license_required"})

    return token


def make_rate_limit_dep(endpoint: str, max_requests: int, window_seconds: int):
    async def _check(token: str = __import__('fastapi').Depends(require_token)) -> str:
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

- [ ] **Step 3: Run existing backend tests to check for breakage**

```bash
cd backend && python -m pytest tests/ -v 2>&1 | head -60
```
Expected: Some auth tests fail (they expect old stub behaviour) — that's correct, we'll fix them next.

- [ ] **Step 4: Update test_auth.py**

Read the file, then replace the stub-mode tests with ExtensionPay-aware tests:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _mock_extpay(paid: bool):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"paid": paid}
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.get = AsyncMock(return_value=mock_response)
    return mock_client


def test_missing_auth_returns_401():
    resp = client.get("/api/v1/post-status?post_id=abc&subreddit=python")
    assert resp.status_code == 401


def test_malformed_auth_returns_401():
    resp = client.get(
        "/api/v1/post-status?post_id=abc&subreddit=python",
        headers={"Authorization": "NotBearer token"},
    )
    assert resp.status_code == 401


def test_unpaid_email_returns_403():
    with patch("app.services.license_service.httpx.AsyncClient") as cls:
        cls.return_value = _mock_extpay(paid=False)
        resp = client.get(
            "/api/v1/post-status?post_id=abc&subreddit=python",
            headers={"Authorization": "Bearer free@example.com"},
        )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"] == "pro_license_required"


def test_extensionpay_down_returns_503():
    import httpx
    with patch("app.services.license_service.httpx.AsyncClient") as cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("down"))
        cls.return_value = mock_client
        resp = client.get(
            "/api/v1/post-status?post_id=abc&subreddit=python",
            headers={"Authorization": "Bearer user@example.com"},
        )
    assert resp.status_code == 503
```

- [ ] **Step 5: Run auth tests**

```bash
cd backend && python -m pytest tests/test_auth.py -v
```
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/auth.py backend/tests/test_auth.py
git commit -m "feat: replace stub auth with ExtensionPay email validation"
```

---

## Task 4: Backend — Free-tier risk summary endpoint

**Files:**
- Create: `backend/app/routes/risk_summary.py`
- Create: `backend/tests/test_risk_summary.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_risk_summary.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _mock_praw_risk(risk_level: str = "medium"):
    from app.models import RiskResponse, RiskLevel, ConfidenceLevel
    return RiskResponse(
        subreddit="python",
        username="testuser",
        risk_level=risk_level,
        confidence="medium",
        factors=[],
        recommendation="",
        cached=False,
    )


def test_risk_summary_no_auth_required():
    """No Authorization header needed"""
    with patch("app.routes.risk_summary.check_risk", return_value=_mock_praw_risk()):
        resp = client.get("/api/v1/risk-summary?subreddit=python&username=testuser")
    assert resp.status_code == 200


def test_risk_summary_returns_level_only():
    """Response contains risk_level and score, NOT factors or recommendation"""
    with patch("app.routes.risk_summary.check_risk", return_value=_mock_praw_risk("high")):
        resp = client.get("/api/v1/risk-summary?subreddit=python&username=testuser")
    data = resp.json()
    assert "risk_level" in data
    assert "factors" not in data
    assert "recommendation" not in data


def test_risk_summary_missing_params_returns_422():
    resp = client.get("/api/v1/risk-summary?subreddit=python")
    assert resp.status_code == 422


def test_risk_summary_invalid_subreddit_returns_422():
    resp = client.get("/api/v1/risk-summary?subreddit=" + "x" * 30 + "&username=u")
    assert resp.status_code == 422
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && python -m pytest tests/test_risk_summary.py -v
```
Expected: `404` errors — endpoint doesn't exist yet.

- [ ] **Step 3: Create risk_summary route**

Create `backend/app/routes/risk_summary.py`:

```python
from fastapi import APIRouter, Query
from pydantic import BaseModel
from app.services.risk_service import check_risk

router = APIRouter()


class RiskSummaryResponse(BaseModel):
    subreddit: str
    username: str
    risk_level: str  # "low" | "medium" | "high"
    cached: bool


@router.get("/risk-summary", response_model=RiskSummaryResponse)
def get_risk_summary(
    subreddit: str = Query(..., max_length=21),
    username: str = Query(..., max_length=20),
) -> RiskSummaryResponse:
    """
    Free-tier endpoint. Returns risk level only — no breakdown factors.
    No authentication required.
    """
    full = check_risk(subreddit, username, "unknown")
    return RiskSummaryResponse(
        subreddit=full.subreddit,
        username=full.username,
        risk_level=full.risk_level,
        cached=full.cached,
    )
```

- [ ] **Step 4: Register router and remove license router in main.py**

Read `backend/app/main.py`, then make two changes:

Remove:
```python
app.include_router(license_router.router, prefix="/api/v1")
```

Add (after the existing routers):
```python
from app.routes import risk_summary as risk_summary_router
app.include_router(risk_summary_router.router, prefix="/api/v1")
```

- [ ] **Step 5: Run tests**

```bash
cd backend && python -m pytest tests/test_risk_summary.py -v
```
Expected: All 4 pass.

- [ ] **Step 6: Run full backend suite**

```bash
cd backend && python -m pytest tests/ -v
```
Expected: All pass (some old license tests may need deletion — remove `tests/test_license_route.py` if it exists).

- [ ] **Step 7: Commit**

```bash
git add backend/app/routes/risk_summary.py backend/tests/test_risk_summary.py backend/app/main.py
git commit -m "feat: add free-tier /api/v1/risk-summary endpoint (no auth)"
```

---

## Task 5: Extension — Install ExtensionPay + service worker setup

**Files:**
- Modify: `src/background/index.ts`
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install ExtensionPay**

```bash
npm install extensionpay
```
Expected: `extensionpay` appears in `package.json` dependencies.

- [ ] **Step 2: Read current background/index.ts**

Read `src/background/index.ts` to understand current structure.

- [ ] **Step 3: Rewrite background/index.ts**

Replace `src/background/index.ts`:

```typescript
import ExtPay from 'extensionpay';

// IMPORTANT: ExtPay and onPaid must be registered at the TOP LEVEL of the service worker.
// MV3 service workers are non-persistent — they cold-start on every event.
// Registering inside onInstalled/onStartup alone would miss wakes triggered by
// alarms or messages. Top-level registration runs on every SW instantiation.
const extpay = ExtPay('r3-reddit-rules'); // Replace with your ExtensionPay extension slug

extpay.startBackground();

extpay.onPaid.addListener((user) => {
  // Store email as Pro bearer token in persistent storage
  chrome.storage.local.set({ r3_pro_paid: true, r3_pro_email: user.email ?? '' });

  // Notify all open panels so they re-render without a page reload
  chrome.runtime.sendMessage({ type: 'LICENSE_UPDATED', paid: true }).catch(() => {
    // No panel open — that's fine
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[R3] Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[R3] Browser started');
});
```

> **Note:** Replace `'r3-reddit-rules'` with your actual ExtensionPay extension slug from your ExtensionPay dashboard after creating your account.

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
npm run build 2>&1 | tail -20
```
Expected: Build succeeds, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts package.json package-lock.json
git commit -m "feat: ExtensionPay service worker init with onPaid listener"
```

---

## Task 6: Extension — Add types for license and risk summary

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Read current types.ts**

Read `src/shared/types.ts` to see existing types.

- [ ] **Step 2: Add new types**

Append to `src/shared/types.ts`:

```typescript
export interface RiskSummaryResponse {
  subreddit: string;
  username: string;
  risk_level: 'low' | 'medium' | 'high';
  cached: boolean;
}

export interface LicenseState {
  paid: boolean;
  email: string;
}
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -5
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add RiskSummaryResponse and LicenseState types"
```

---

## Task 7: Extension — Add fetchRiskSummary to backendClient

**Files:**
- Modify: `src/panel/api/backendClient.ts`

- [ ] **Step 1: Read current backendClient.ts**

Read `src/panel/api/backendClient.ts` in full.

- [ ] **Step 2: Add storage keys and fetchRiskSummary**

Add after the existing `PRO_TOKEN_KEY` constant and storage helpers. Keep all existing functions. Add:

```typescript
const PRO_EMAIL_KEY = 'r3_pro_email';

export async function getProEmail(): Promise<string> {
  const result = await chrome.storage.local.get(PRO_EMAIL_KEY);
  return (result[PRO_EMAIL_KEY] as string) ?? '';
}
```

Add `fetchRiskSummary` at the end of the file:

```typescript
import type { RiskSummaryResponse } from '../../shared/types';

export async function fetchRiskSummary(
  subreddit: string,
  username: string
): Promise<RiskSummaryResponse> {
  const params = new URLSearchParams({ subreddit, username });
  const resp = await fetch(`${BACKEND_URL}/api/v1/risk-summary?${params}`);
  if (!resp.ok) throw new Error(`RISK_SUMMARY_ERROR:${resp.status}`);
  return resp.json() as Promise<RiskSummaryResponse>;
}
```

Also remove `fetchLicense` (no longer used — the `/api/v1/license` endpoint is gone).

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -10
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/panel/api/backendClient.ts
git commit -m "feat: add fetchRiskSummary (free tier) to backendClient"
```

---

## Task 8: Extension — LicenseContext

**Files:**
- Create: `src/panel/contexts/LicenseContext.tsx`
- Modify: `src/panel/main.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/LicenseContext.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LicenseProvider, useLicense } from '../../src/panel/contexts/LicenseContext';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};
const mockGet = vi.fn((keys: string[]) =>
  Promise.resolve(Object.fromEntries(keys.map((k) => [k, mockStorage[k]])))
);
vi.stubGlobal('chrome', {
  storage: { local: { get: mockGet, set: vi.fn() } },
  runtime: { onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
});

function TestConsumer() {
  const { paid, email } = useLicense();
  return <div data-testid="result">{paid ? `paid:${email}` : 'free'}</div>;
}

describe('LicenseContext', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('reads paid=false from storage on mount', async () => {
    mockGet.mockResolvedValue({ r3_pro_paid: false, r3_pro_email: '' });
    await act(async () => {
      render(<LicenseProvider><TestConsumer /></LicenseProvider>);
    });
    expect(screen.getByTestId('result').textContent).toBe('free');
  });

  it('reads paid=true and email from storage on mount', async () => {
    mockGet.mockResolvedValue({ r3_pro_paid: true, r3_pro_email: 'user@example.com' });
    await act(async () => {
      render(<LicenseProvider><TestConsumer /></LicenseProvider>);
    });
    expect(screen.getByTestId('result').textContent).toBe('paid:user@example.com');
  });

  it('updates when LICENSE_UPDATED message received', async () => {
    mockGet.mockResolvedValue({ r3_pro_paid: false, r3_pro_email: '' });
    let messageListener: ((msg: unknown) => void) | null = null;
    (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (msg: unknown) => void) => { messageListener = fn; }
    );

    await act(async () => {
      render(<LicenseProvider><TestConsumer /></LicenseProvider>);
    });
    expect(screen.getByTestId('result').textContent).toBe('free');

    await act(async () => {
      messageListener?.({ type: 'LICENSE_UPDATED', paid: true, email: 'new@example.com' });
    });
    expect(screen.getByTestId('result').textContent).toBe('paid:new@example.com');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/components/LicenseContext.test.tsx 2>&1 | tail -15
```
Expected: Cannot find module `LicenseContext`.

- [ ] **Step 3: Create LicenseContext.tsx**

Create `src/panel/contexts/LicenseContext.tsx`:

```tsx
import ExtPay from 'extensionpay';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const extpay = ExtPay('r3-reddit-rules'); // Same slug as background/index.ts

interface LicenseContextValue {
  paid: boolean;
  email: string;
  openPaymentPage: () => void;
}

const LicenseContext = createContext<LicenseContextValue>({
  paid: false,
  email: '',
  openPaymentPage: () => {},
});

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [paid, setPaid] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Read cached state from storage on mount (instant, no flicker)
    chrome.storage.local
      .get(['r3_pro_paid', 'r3_pro_email'])
      .then((result) => {
        if (result['r3_pro_paid']) {
          setPaid(true);
          setEmail((result['r3_pro_email'] as string) ?? '');
        }
      });

    // Listen for SW messages when payment completes mid-session
    const handler = (msg: unknown) => {
      if (
        typeof msg === 'object' &&
        msg !== null &&
        (msg as { type: string }).type === 'LICENSE_UPDATED'
      ) {
        const { paid: newPaid, email: newEmail } = msg as { paid: boolean; email?: string };
        setPaid(newPaid);
        setEmail(newEmail ?? '');
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  return (
    <LicenseContext.Provider
      value={{ paid, email, openPaymentPage: () => extpay.openPaymentPage() }}
    >
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  return useContext(LicenseContext);
}
```

- [ ] **Step 4: Wrap app in LicenseProvider**

Read `src/panel/main.tsx`, then wrap the root render with `<LicenseProvider>`:

```tsx
import { LicenseProvider } from './contexts/LicenseContext';

// In mountR3Panel, wrap <App /> (or whatever the root component is):
root.render(
  <LicenseProvider>
    <App />
  </LicenseProvider>
);
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/components/LicenseContext.test.tsx 2>&1 | tail -20
```
Expected: All 3 pass.

- [ ] **Step 6: Build**

```bash
npm run build 2>&1 | tail -10
```
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/panel/contexts/LicenseContext.tsx src/panel/main.tsx tests/components/LicenseContext.test.tsx
git commit -m "feat: LicenseContext with storage read + SW message listener"
```

---

## Task 9: Extension — ProLock and UpgradeCTA components

**Files:**
- Create: `src/panel/components/ProLock.tsx`
- Create: `src/panel/components/UpgradeCTA.tsx`
- Create: `src/panel/components/Toast.tsx`

- [ ] **Step 1: Create ProLock.tsx**

Create `src/panel/components/ProLock.tsx`:

```tsx
interface ProLockProps {
  label: string;
}

/**
 * Renders a blurred placeholder row with a lock icon.
 * Used inside free-tier cards to indicate locked Pro fields.
 */
export function ProLock({ label }: ProLockProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.6 }}>
      <span aria-hidden="true">🔒</span>
      <span
        style={{
          filter: 'blur(4px)',
          userSelect: 'none',
          flex: 1,
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
          height: 16,
        }}
        aria-label={`${label} — Pro only`}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create UpgradeCTA.tsx**

Create `src/panel/components/UpgradeCTA.tsx`:

```tsx
import { useLicense } from '../contexts/LicenseContext';

/**
 * Single persistent upgrade bar pinned to panel footer.
 * Only rendered for free users.
 */
export function UpgradeCTA() {
  const { paid, openPaymentPage } = useLicense();
  if (paid) return null;

  return (
    <div
      style={{
        padding: '10px 16px',
        borderTop: '1px solid #e5e7eb',
        background: '#f9fafb',
        textAlign: 'center',
      }}
    >
      <button
        onClick={openPaymentPage}
        style={{
          background: '#ff4500',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '8px 20px',
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        🔓 Unlock Pro — $5 one-time
      </button>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280' }}>
        No account. No subscription. Pay once.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create Toast.tsx**

Create `src/panel/components/Toast.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useLicense } from '../contexts/LicenseContext';

/**
 * Shows a "Pro unlocked" toast for 3 seconds after payment completes.
 * Listens for LICENSE_UPDATED message to trigger display.
 */
export function ProUnlockedToast() {
  const { paid } = useLicense();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (msg: unknown) => {
      if (
        typeof msg === 'object' &&
        msg !== null &&
        (msg as { type: string }).type === 'LICENSE_UPDATED' &&
        (msg as { paid: boolean }).paid
      ) {
        setVisible(true);
        setTimeout(() => setVisible(false), 3000);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#22c55e',
        color: '#fff',
        padding: '8px 20px',
        borderRadius: 20,
        fontWeight: 600,
        fontSize: 14,
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        animation: 'fadeIn 0.2s ease',
      }}
      role="status"
    >
      ✅ Pro unlocked!
    </div>
  );
}
```

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | tail -10
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/panel/components/ProLock.tsx src/panel/components/UpgradeCTA.tsx src/panel/components/Toast.tsx
git commit -m "feat: ProLock, UpgradeCTA, and ProUnlockedToast components"
```

---

## Task 10: Extension — Update RiskCard for free/pro tiers

**Files:**
- Modify: `src/panel/components/RiskCard.tsx`
- Modify: `tests/components/RiskCard.test.tsx`

- [ ] **Step 1: Read current RiskCard.tsx and its tests**

Read both files in full.

- [ ] **Step 2: Add free-tier tests**

In `tests/components/RiskCard.test.tsx`, add these test cases (keep all existing tests):

```tsx
import { vi } from 'vitest';
import * as backendClient from '../../src/panel/api/backendClient';

// Mock LicenseContext
vi.mock('../../src/panel/contexts/LicenseContext', () => ({
  useLicense: vi.fn(),
}));
import { useLicense } from '../../src/panel/contexts/LicenseContext';

describe('RiskCard — free tier', () => {
  it('shows risk score for free users via risk-summary', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: false, email: '' });
    vi.spyOn(backendClient, 'fetchRiskSummary').mockResolvedValue({
      subreddit: 'python',
      username: 'testuser',
      risk_level: 'high',
      cached: false,
    });

    const { findByText } = render(
      <RiskCard subreddit="python" username="testuser" />
    );
    await findByText(/high/i);
  });

  it('shows ProLock for breakdown fields in free tier', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: false, email: '' });
    vi.spyOn(backendClient, 'fetchRiskSummary').mockResolvedValue({
      subreddit: 'python',
      username: 'testuser',
      risk_level: 'medium',
      cached: false,
    });

    const { findAllByLabelText } = render(
      <RiskCard subreddit="python" username="testuser" />
    );
    const locks = await findAllByLabelText(/Pro only/i);
    expect(locks.length).toBeGreaterThan(0);
  });

  it('shows full breakdown for pro users', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({
      paid: true,
      email: 'user@example.com',
    });
    vi.spyOn(backendClient, 'fetchRisk').mockResolvedValue({
      subreddit: 'python',
      username: 'testuser',
      risk_level: 'high',
      confidence: 'high',
      factors: [{ type: 'karma', impact: 'high', message: 'Low karma' }],
      recommendation: 'Post carefully',
      cached: false,
    });

    const { findByText } = render(
      <RiskCard subreddit="python" username="testuser" />
    );
    await findByText(/Low karma/i);
    await findByText(/Post carefully/i);
  });
});
```

- [ ] **Step 3: Run new tests to verify they fail**

```bash
npm test -- tests/components/RiskCard.test.tsx 2>&1 | tail -20
```
Expected: New tests fail — RiskCard doesn't use LicenseContext yet.

- [ ] **Step 4: Update RiskCard.tsx**

Read the full file first. Then rewrite to add free/pro split. Key changes:

1. Import `useLicense`, `fetchRiskSummary`, `ProLock`
2. Add a `FreeSummaryState` type:

```typescript
type FreeSummaryState =
  | { type: 'loading' }
  | { type: 'success'; risk_level: 'low' | 'medium' | 'high' }
  | { type: 'error' };
```

3. In the component body, read `const { paid, email } = useLicense();`

4. For free tier: fetch from `fetchRiskSummary`, show score + 3 ProLock rows for breakdown

5. For pro tier: keep existing fetch logic but use `email` as the bearer (via existing `getProToken()` which now reads from storage key `r3_pro_email`)

The free tier body:
```tsx
function FreeTierRiskBody({ state }: { state: FreeSummaryState }) {
  if (state.type === 'loading') return <p>Checking risk…</p>;
  if (state.type === 'error') return <p>Could not load risk score.</p>;

  const level = state.risk_level;
  const color = level === 'high' ? '#ef4444' : level === 'medium' ? '#f59e0b' : '#22c55e';

  return (
    <div>
      <div style={{ fontWeight: 700, color, marginBottom: 8 }}>
        Account Risk: {level.toUpperCase()}
      </div>
      <ProLock label="Karma ratio" />
      <ProLock label="Account age" />
      <ProLock label="Shadowban check" />
    </div>
  );
}
```

And in the main component, branch on `paid`:

```tsx
if (!paid) {
  // fetch from /api/v1/risk-summary
  // render <FreeTierRiskBody />
} else {
  // existing pro logic using email as bearer
}
```

- [ ] **Step 5: Run all RiskCard tests**

```bash
npm test -- tests/components/RiskCard.test.tsx 2>&1 | tail -20
```
Expected: All pass (existing + new).

- [ ] **Step 6: Commit**

```bash
git add src/panel/components/RiskCard.tsx tests/components/RiskCard.test.tsx
git commit -m "feat: RiskCard free tier (summary + ProLock) vs Pro tier (full breakdown)"
```

---

## Task 11: Extension — Update StatusCard for free/pro tiers

**Files:**
- Modify: `src/panel/components/StatusCard.tsx`
- Modify: `tests/components/StatusCard.test.tsx`

- [ ] **Step 1: Read current StatusCard.tsx and tests**

Read both files in full.

- [ ] **Step 2: Add free-tier tests**

In `tests/components/StatusCard.test.tsx`, add:

```tsx
vi.mock('../../src/panel/contexts/LicenseContext', () => ({
  useLicense: vi.fn(),
}));
import { useLicense } from '../../src/panel/contexts/LicenseContext';

describe('StatusCard — free tier', () => {
  it('shows teaser with feature description for free users', () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: false });
    const { getByText } = render(
      <StatusCard postId="abc123" username="testuser" subreddit="python" />
    );
    expect(getByText(/post removal detection/i)).toBeTruthy();
  });

  it('does not call fetchPostStatus for free users', () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: false });
    const spy = vi.spyOn(backendClient, 'fetchPostStatus');
    render(<StatusCard postId="abc123" username="testuser" subreddit="python" />);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('StatusCard — pro tier', () => {
  it('fetches post status for pro users', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({
      paid: true,
      email: 'user@example.com',
    });
    vi.spyOn(backendClient, 'getProToken').mockResolvedValue('user@example.com');
    vi.spyOn(backendClient, 'fetchPostStatus').mockResolvedValue({
      post_id: 'abc123',
      subreddit: 'python',
      status: 'removed',
      visible_to_public: false,
      reason_hint: 'missing_from_listing',
      checked_at: new Date().toISOString(),
      cached: false,
    });

    const { findByText } = render(
      <StatusCard postId="abc123" username="testuser" subreddit="python" />
    );
    await findByText(/removed/i);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
npm test -- tests/components/StatusCard.test.tsx 2>&1 | tail -15
```
Expected: New tests fail.

- [ ] **Step 4: Update StatusCard.tsx**

Read the file. Add `useLicense` import and branch on `paid`:

```tsx
// Free tier: show static teaser, no API call
function FreeTierStatusBody() {
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Post Removal Detection</div>
      <ProLock label="Post visibility status" />
      <ProLock label="Removal reason" />
      <ProLock label="Checked at" />
      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
        Detects silent post removals by moderators.
      </p>
    </div>
  );
}
```

In the component: `const { paid } = useLicense();`

If `!paid`, render `<FreeTierStatusBody />` and skip all fetching logic.

If `paid`, keep existing fetch + state machine logic unchanged.

- [ ] **Step 5: Run all StatusCard tests**

```bash
npm test -- tests/components/StatusCard.test.tsx 2>&1 | tail -20
```
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/panel/components/StatusCard.tsx tests/components/StatusCard.test.tsx
git commit -m "feat: StatusCard free teaser vs Pro full post-status fetch"
```

---

## Task 12: Extension — Wire UpgradeCTA into PanelFooter + Toast into panel

**Files:**
- Modify: `src/panel/components/PanelFooter.tsx`
- Modify: `src/panel/main.tsx` (or FloatingPanel.tsx — wherever the panel root renders)

- [ ] **Step 1: Read PanelFooter.tsx and FloatingPanel.tsx**

Read both files.

- [ ] **Step 2: Add UpgradeCTA to PanelFooter**

In `PanelFooter.tsx`, import and render `<UpgradeCTA />` at the bottom of the footer:

```tsx
import { UpgradeCTA } from './UpgradeCTA';

// At the bottom of the footer JSX:
<UpgradeCTA />
```

- [ ] **Step 3: Add ProUnlockedToast to panel root**

In `FloatingPanel.tsx` (or `main.tsx`), import and render `<ProUnlockedToast />` alongside the panel:

```tsx
import { ProUnlockedToast } from './components/Toast';

// Inside render, alongside other panel content:
<ProUnlockedToast />
```

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | tail -10
```
Expected: No errors.

- [ ] **Step 5: Run full test suite**

```bash
npm test 2>&1 | tail -20
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/panel/components/PanelFooter.tsx src/panel/main.tsx
git commit -m "feat: UpgradeCTA in footer, ProUnlockedToast in panel root"
```

---

## Task 13: UpgradeCTA test

**Files:**
- Create: `tests/components/UpgradeCTA.test.tsx`

- [ ] **Step 1: Write tests**

Create `tests/components/UpgradeCTA.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { UpgradeCTA } from '../../src/panel/components/UpgradeCTA';

vi.mock('../../src/panel/contexts/LicenseContext', () => ({
  useLicense: vi.fn(),
}));
import { useLicense } from '../../src/panel/contexts/LicenseContext';

describe('UpgradeCTA', () => {
  it('renders for free users', () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({
      paid: false,
      openPaymentPage: vi.fn(),
    });
    render(<UpgradeCTA />);
    expect(screen.getByText(/Unlock Pro/i)).toBeTruthy();
    expect(screen.getByText(/No account/i)).toBeTruthy();
  });

  it('renders nothing for pro users', () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({
      paid: true,
      openPaymentPage: vi.fn(),
    });
    const { container } = render(<UpgradeCTA />);
    expect(container.firstChild).toBeNull();
  });

  it('calls openPaymentPage on click', () => {
    const mockOpen = vi.fn();
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({
      paid: false,
      openPaymentPage: mockOpen,
    });
    render(<UpgradeCTA />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockOpen).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- tests/components/UpgradeCTA.test.tsx 2>&1 | tail -15
```
Expected: All 3 pass.

- [ ] **Step 3: Commit**

```bash
git add tests/components/UpgradeCTA.test.tsx
git commit -m "test: UpgradeCTA free/pro/click behaviour"
```

---

## Task 14: Full verification

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && python -m pytest tests/ -v 2>&1 | tail -30
```
Expected: All pass, 0 failures.

- [ ] **Step 2: Run full extension test suite**

```bash
cd .. && npm test 2>&1 | tail -30
```
Expected: All pass, 0 failures.

- [ ] **Step 3: Build extension**

```bash
npm run build 2>&1 | tail -10
```
Expected: Clean build.

- [ ] **Step 4: Check TypeScript**

```bash
npx tsc --noEmit 2>&1
```
Expected: No errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: ExtensionPay integration complete — free tier teasers, Pro gating, backend validation"
```

---

## Post-Implementation: ExtensionPay Account Setup (manual steps)

These require the developer to take action in external systems — not automatable:

1. Create account at [extensionpay.com](https://extensionpay.com)
2. Create a new extension with slug `r3-reddit-rules` (or whatever slug you chose)
3. Set price to **$5 one-time**
4. Copy `EXTENSIONPAY_SECRET_KEY` from dashboard → add to `backend/.env` (never commit)
5. Set `LICENSE_MODE=extensionpay` in `backend/.env`
6. Replace `'r3-reddit-rules'` in `background/index.ts` and `LicenseContext.tsx` with your real slug if different
7. Test payment flow with ExtensionPay's test mode
