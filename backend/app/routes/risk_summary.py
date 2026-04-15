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
