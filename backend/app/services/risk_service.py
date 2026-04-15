import re
from datetime import datetime, timezone
from app.cache import cache
from app.config import settings
from app.models import RiskResponse, RiskFactor
from app.praw_client import get_reddit_client


def check_risk(subreddit: str, username: str, post_type: str) -> RiskResponse:
    cache_key = f"risk:{subreddit}:{username}:{post_type}"
    cached_data = cache.get(cache_key)
    if cached_data is not None:
        return RiskResponse(**{**cached_data, "cached": True})

    result = _compute_risk(subreddit, username, post_type)
    cache.set(cache_key, result.model_dump(exclude={"cached"}), settings.cache_ttl_risk)
    return result


def _compute_risk(subreddit: str, username: str, post_type: str) -> RiskResponse:
    reddit = get_reddit_client()
    factors: list[RiskFactor] = []
    signals_available = 0
    signals_total = 0

    sub_meta = _get_subreddit_meta(reddit, subreddit)
    user_data = _get_user_data(reddit, username)

    # ── Karma factor ──────────────────────────────────────────────────────────
    karma_threshold = sub_meta.get("karma_threshold") if sub_meta else None
    if karma_threshold is not None:
        signals_total += 1
        if user_data:
            signals_available += 1
            user_karma = user_data["karma"]
            if user_karma < karma_threshold:
                factors.append(RiskFactor(
                    type="karma",
                    impact="high",
                    message=f"User karma ({user_karma}) may be below the subreddit threshold (~{karma_threshold}).",
                ))

    # ── Account age factor ────────────────────────────────────────────────────
    age_threshold = sub_meta.get("account_age_days") if sub_meta else None
    if age_threshold is not None:
        signals_total += 1
        if user_data:
            signals_available += 1
            actual_age = user_data["account_age_days"]
            if actual_age < age_threshold:
                factors.append(RiskFactor(
                    type="account_age",
                    impact="high",
                    message=f"Account age ({actual_age} days) may be below the subreddit threshold (~{age_threshold} days).",
                ))

    # ── Flair factor ──────────────────────────────────────────────────────────
    if sub_meta and sub_meta.get("flair_required"):
        signals_total += 1
        signals_available += 1
        factors.append(RiskFactor(
            type="flair_required",
            impact="medium",
            message="This subreddit requires post flair. Make sure to select flair before posting.",
        ))

    # ── Derive risk level ─────────────────────────────────────────────────────
    high_count = sum(1 for f in factors if f.impact == "high")
    med_count = sum(1 for f in factors if f.impact == "medium")

    if high_count >= 2:
        risk_level = "high"
    elif high_count >= 1 or med_count >= 2:
        risk_level = "medium"
    else:
        risk_level = "low"

    # ── Derive confidence ─────────────────────────────────────────────────────
    if signals_total == 0:
        confidence = "low"
    elif signals_available / signals_total >= 0.7:
        confidence = "high"
    elif signals_available / signals_total >= 0.4:
        confidence = "medium"
    else:
        confidence = "low"

    # ── Recommendation ────────────────────────────────────────────────────────
    if risk_level == "high":
        rec = "High removal risk. Address the flagged factors before posting."
    elif risk_level == "medium":
        rec = "Moderate removal risk. Review flagged factors before posting."
    else:
        rec = "Low removal risk. Your post appears likely to meet this subreddit's requirements."

    if confidence == "low":
        rec += " (Low confidence — limited subreddit data available.)"

    return RiskResponse(
        subreddit=subreddit,
        username=username,
        risk_level=risk_level,
        confidence=confidence,
        factors=factors,
        recommendation=rec,
        cached=False,
    )


def _get_subreddit_meta(reddit, subreddit: str) -> dict | None:
    cache_key = f"subreddit_meta:{subreddit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    meta: dict = {}

    try:
        sub = reddit.subreddit(subreddit)
        meta["flair_required"] = getattr(sub, "link_flair_required", False)
    except Exception:
        pass  # degrade gracefully

    try:
        wiki_page = reddit.subreddit(subreddit).wiki["automoderator"]
        thresholds = _parse_automod_thresholds(wiki_page.content_md)
        meta.update(thresholds)
    except Exception:
        pass  # automod not accessible — that's fine

    cache.set(cache_key, meta, settings.cache_ttl_subreddit_meta)
    return meta


def _get_user_data(reddit, username: str) -> dict | None:
    try:
        redditor = reddit.redditor(username)
        _ = redditor.id  # force fetch; raises if user doesn't exist
        age_days = (
            datetime.now(timezone.utc)
            - datetime.fromtimestamp(redditor.created_utc, timezone.utc)
        ).days
        return {
            "karma": redditor.link_karma + redditor.comment_karma,
            "account_age_days": age_days,
        }
    except Exception:
        return None  # degrade gracefully


def _parse_automod_thresholds(automod_text: str) -> dict:
    """Extract karma/age thresholds from automod config YAML text."""
    thresholds: dict = {}

    karma_match = re.search(
        r"(?:combined_karma|link_karma|comment_karma)\s*[<>]?\s*(\d+)",
        automod_text,
    )
    if karma_match:
        thresholds["karma_threshold"] = int(karma_match.group(1))

    age_match = re.search(
        r"account_age\s*[<>]?\s*(\d+)\s*(?:day|days)",
        automod_text,
    )
    if age_match:
        thresholds["account_age_days"] = int(age_match.group(1))

    return thresholds
