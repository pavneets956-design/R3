from fastapi import APIRouter, Depends, Query
from app.models import PostStatusResponse
from app.auth import make_rate_limit_dep
from app.services.post_status_service import get_post_status

router = APIRouter()
_rate_limit = make_rate_limit_dep("post_status", max_requests=10, window_seconds=10)


@router.get("/post-status", response_model=PostStatusResponse)
async def post_status(
    post_id: str = Query(..., max_length=20),  # Reddit post IDs are base-36, typically 5-7 chars
    subreddit: str = Query(..., max_length=50),  # Reddit subreddit name max is 21 chars + buffer
    _token: str = Depends(_rate_limit),
):
    return await get_post_status(post_id, subreddit)
