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

    email = email.strip().lower()

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
                auth=("", settings.extensionpay_secret_key),
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


async def validate_license_stub(email: str) -> bool:
    """Stub mode: any non-empty email is treated as paid (dev only)."""
    return bool(email)
