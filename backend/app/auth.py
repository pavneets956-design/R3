from typing import Optional
from fastapi import Header, HTTPException, Depends
from app.config import settings
from app.cache import rate_limiter


async def require_token(authorization: Optional[str] = Header(default=None)) -> str:
    """Validate Authorization: Bearer {token} header. Returns the token."""
    if not authorization:
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})
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
