import re
import httpx
from app.cache import cache
from app.config import settings

EXTENSION_ID = "r3--reddit-rules-enforcer"
EXTENSIONPAY_API = f"https://extensionpay.com/extension/{EXTENSION_ID}/api/v2/user"
LICENSE_CACHE_TTL = 900  # 15 minutes for paid=true only

# ExtPay api_keys are UUID v4 format (hex chars + hyphens, 36 chars).
# Reject obviously malformed tokens before spending an HTTP round-trip.
_API_KEY_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)


class LicenseServiceError(Exception):
    """Raised when ExtensionPay API is unreachable."""


async def validate_license(api_key: str) -> bool:
    """
    Returns True if the ExtPay api_key belongs to a paid user.
    Caches paid=True results for 15 minutes.
    paid=False is never cached (new paying users must not wait).
    Raises LicenseServiceError if ExtensionPay is unreachable.
    """
    if not api_key:
        return False

    api_key = api_key.strip()

    # Reject malformed keys early — saves a round-trip and protects rate limits.
    if not _API_KEY_RE.match(api_key):
        return False

    if settings.license_mode == "stub":
        return await validate_license_stub(api_key)

    cache_key = f"license:{api_key}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                EXTENSIONPAY_API,
                params={"api_key": api_key},
            )
    except (httpx.ConnectError, httpx.TimeoutException, httpx.RequestError) as exc:
        raise LicenseServiceError(f"ExtensionPay unreachable: {exc}") from exc

    if resp.status_code == 404:
        return False
    if resp.status_code != 200:
        raise LicenseServiceError(f"ExtensionPay returned {resp.status_code}")

    paid = bool(resp.json().get("paid", False))
    if paid:
        cache.set(cache_key, True, LICENSE_CACHE_TTL)
    # paid=False: intentionally not cached
    return paid


async def validate_license_stub(api_key: str) -> bool:
    """Stub mode: any non-empty api_key is treated as paid (dev only)."""
    return bool(api_key)
