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
