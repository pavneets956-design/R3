import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta


@pytest.fixture(autouse=True)
def reset_cache_and_limiter():
    from app.cache import cache, rate_limiter
    cache._store.clear()
    rate_limiter._windows.clear()
    yield


def _make_mock_redditor(karma=500, created_days_ago=120):
    mock_user = MagicMock()
    mock_user.id = "abc"
    mock_user.link_karma = karma // 2
    mock_user.comment_karma = karma // 2
    created_utc = (datetime.now(timezone.utc) - timedelta(days=created_days_ago)).timestamp()
    mock_user.created_utc = created_utc
    return mock_user


def _make_mock_subreddit(submission_type="any"):
    mock_sub = MagicMock()
    mock_sub.submission_type = submission_type
    mock_sub.link_flair_required = False
    return mock_sub


async def test_risk_returns_valid_response(client, auth_headers):
    with patch("app.services.risk_service.get_reddit_client") as mock_get_client:
        mock_reddit = MagicMock()
        mock_reddit.redditor.return_value = _make_mock_redditor()
        mock_reddit.subreddit.return_value = _make_mock_subreddit()
        mock_reddit.subreddit.return_value.wiki.__getitem__.side_effect = Exception("forbidden")
        mock_get_client.return_value = mock_reddit

        resp = await client.post(
            "/api/v1/risk",
            json={"subreddit": "learnprogramming", "username": "testuser", "post_type": "text"},
            headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["risk_level"] in ("low", "medium", "high")
    assert data["confidence"] in ("low", "medium", "high")
    assert isinstance(data["factors"], list)
    assert "recommendation" in data
    assert "cached" in data


async def test_risk_degrades_gracefully_when_user_unavailable(client, auth_headers):
    """If PRAW can't fetch user data, still return a response with low confidence."""
    with patch("app.services.risk_service.get_reddit_client") as mock_get_client, \
         patch("app.services.risk_service._get_user_data", return_value=None), \
         patch("app.services.risk_service._get_subreddit_meta", return_value={"karma_threshold": 100}):
        mock_reddit = MagicMock()
        mock_get_client.return_value = mock_reddit

        resp = await client.post(
            "/api/v1/risk",
            json={"subreddit": "learnprogramming", "username": "ghost_user", "post_type": "text"},
            headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["confidence"] == "low"


async def test_risk_requires_auth(client):
    resp = await client.post(
        "/api/v1/risk",
        json={"subreddit": "learnprogramming", "username": "testuser", "post_type": "text"},
    )
    assert resp.status_code == 401


async def test_risk_rate_limit(client, auth_headers):
    from unittest.mock import patch

    with patch("app.services.risk_service.get_reddit_client") as mock_get_client:
        mock_reddit = MagicMock()
        mock_reddit.redditor.return_value = _make_mock_redditor()
        mock_reddit.subreddit.return_value = _make_mock_subreddit()
        mock_reddit.subreddit.return_value.wiki.__getitem__.side_effect = Exception("forbidden")
        mock_get_client.return_value = mock_reddit

        headers = {"Authorization": "Bearer c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f"}

        for _ in range(5):
            await client.post(
                "/api/v1/risk",
                json={"subreddit": "learnprogramming", "username": "u", "post_type": "text"},
                headers=headers,
            )
        resp = await client.post(
            "/api/v1/risk",
            json={"subreddit": "learnprogramming", "username": "u", "post_type": "text"},
            headers=headers,
        )

    assert resp.status_code == 429
