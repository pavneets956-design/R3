from app.models import LicenseResponse, LicenseFeatures


def get_license() -> LicenseResponse:
    """Return license status. Phase 2: always valid in stub mode.
    Phase 2.5: replace body with ExtensionPay API call."""
    return LicenseResponse(
        valid=True,
        plan="pro",
        expires_at=None,
        features=LicenseFeatures(risk=True, post_status=True),
    )
