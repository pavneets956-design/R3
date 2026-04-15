import re
import httpx
from datetime import datetime, timezone
from app.models import PostStatusResponse
from app.config import settings
from app.cache import cache

REDDIT_POST_URL = "https://www.reddit.com/r/{subreddit}/comments/{post_id}/.json"

_SAFE_SEGMENT = re.compile(r'^[A-Za-z0-9_]{1,50}$')


async def get_post_status(post_id: str, subreddit: str) -> PostStatusResponse:
    cache_key = f"post_status:{subreddit}:{post_id}"
    cached = cache.get(cache_key)
    if cached:
        return PostStatusResponse(**{**cached, "cached": True})

    now_iso = datetime.now(timezone.utc).isoformat()
    result = await _check_visibility(post_id, subreddit, now_iso)
    # Store in cache (without cached=True so we can set it on read)
    store = result.model_dump()
    store["cached"] = False
    cache.set(cache_key, store, settings.cache_ttl_post_status)
    return result


async def _check_visibility(post_id: str, subreddit: str, checked_at: str) -> PostStatusResponse:
    if not _SAFE_SEGMENT.match(post_id) or not _SAFE_SEGMENT.match(subreddit):
        return PostStatusResponse(
            post_id=post_id, subreddit=subreddit, status="unknown",
            visible_to_public=False, reason_hint="fetch_failed",
            checked_at=checked_at, cached=False
        )

    # Fetch the post directly
    url = REDDIT_POST_URL.format(subreddit=subreddit, post_id=post_id)
    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": settings.reddit_user_agent},
            follow_redirects=True,
        ) as client:
            resp = await client.get(url, timeout=8.0)
    except Exception:
        # network error or timeout — treat as fetch_failed
        return PostStatusResponse(
            post_id=post_id,
            subreddit=subreddit,
            status="unknown",
            visible_to_public=False,
            reason_hint="fetch_failed",
            checked_at=checked_at,
            cached=False,
        )

    if resp.status_code != 200:
        return PostStatusResponse(
            post_id=post_id,
            subreddit=subreddit,
            status="unknown",
            visible_to_public=False,
            reason_hint="fetch_failed",
            checked_at=checked_at,
            cached=False,
        )

    try:
        data = resp.json()
        post_data = data[0]["data"]["children"][0]["data"]
        is_removed = post_data.get("removed_by_category") is not None
        is_deleted = post_data.get("author") == "[deleted]"
    except Exception:
        return PostStatusResponse(
            post_id=post_id,
            subreddit=subreddit,
            status="unknown",
            visible_to_public=False,
            reason_hint="insufficient_signal",
            checked_at=checked_at,
            cached=False,
        )

    if is_removed:
        return PostStatusResponse(
            post_id=post_id,
            subreddit=subreddit,
            status="removed",
            visible_to_public=False,
            reason_hint="missing_from_listing",
            checked_at=checked_at,
            cached=False,
        )
    if is_deleted:
        return PostStatusResponse(
            post_id=post_id,
            subreddit=subreddit,
            status="removed",
            visible_to_public=False,
            reason_hint="deleted_by_author",
            checked_at=checked_at,
            cached=False,
        )
    return PostStatusResponse(
        post_id=post_id,
        subreddit=subreddit,
        status="visible",
        visible_to_public=True,
        reason_hint=None,
        checked_at=checked_at,
        cached=False,
    )
