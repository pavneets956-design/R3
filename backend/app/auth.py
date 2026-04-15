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
    from fastapi import Depends
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
