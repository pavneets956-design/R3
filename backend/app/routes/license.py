from fastapi import APIRouter, Depends
from app.auth import require_token
from app.models import LicenseResponse
from app.services.license_service import get_license

router = APIRouter()


@router.get("/license", response_model=LicenseResponse)
async def get_license_route(token: str = Depends(require_token)):
    return get_license()
