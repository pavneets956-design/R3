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
