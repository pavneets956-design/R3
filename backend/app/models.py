from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


# ── License ───────────────────────────────────────────────────────────────────

class LicenseFeatures(BaseModel):
    risk: bool = True
    post_status: bool = True


class LicenseResponse(BaseModel):
    valid: bool
    plan: str
    expires_at: str | None
    features: LicenseFeatures


# ── Post Status ───────────────────────────────────────────────────────────────

ReasonHint = Literal[
    "missing_from_listing",
    "deleted_by_author",
    "fetch_failed",
    "insufficient_signal",
]


class PostStatusResponse(BaseModel):
    post_id: str
    subreddit: str
    status: Literal["visible", "removed", "unknown"]
    visible_to_public: bool
    reason_hint: ReasonHint | None
    checked_at: str
    cached: bool


# ── Risk ─────────────────────────────────────────────────────────────────────

PostType = Literal["text", "link", "image", "video", "unknown"]
ImpactLevel = Literal["high", "medium", "low"]
RiskLevel = Literal["low", "medium", "high"]
ConfidenceLevel = Literal["low", "medium", "high"]


class RiskFactor(BaseModel):
    type: str
    impact: ImpactLevel
    message: str


class RiskRequest(BaseModel):
    subreddit: str = Field(..., max_length=21)
    username: str = Field(..., max_length=20)
    post_type: PostType = "unknown"


class RiskResponse(BaseModel):
    subreddit: str
    username: str
    risk_level: RiskLevel
    confidence: ConfidenceLevel
    factors: list[RiskFactor]
    recommendation: str
    cached: bool
