import pytest
from unittest.mock import AsyncMock, patch, MagicMock


def make_reddit_response(post_data: dict, status_code: int = 200):
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = [{"data": {"children": [{"data": post_data}]}}]
    return mock_resp


def make_mock_http_client(mock_resp):
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_client)
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    return mock_cm


@pytest.fixture(autouse=True)
def reset_cache_and_limiter():
    from app.cache import cache, rate_limiter
    cache._store.clear()
    rate_limiter._windows.clear()
    yield


async def test_post_status_missing_post_id(client, auth_headers):
    resp = await client.get("/api/v1/post-status?subreddit=learnpython", headers=auth_headers)
    assert resp.status_code == 422


async def test_post_status_missing_subreddit(client, auth_headers):
    resp = await client.get("/api/v1/post-status?post_id=abc123", headers=auth_headers)
    assert resp.status_code == 422


async def test_post_status_unauthorized(client):
    resp = await client.get("/api/v1/post-status?post_id=abc&subreddit=learnpython")
    assert resp.status_code == 401


async def test_post_status_visible(client, auth_headers):
    mock_resp = make_reddit_response({"author": "someuser", "removed_by_category": None})
    mock_cm = make_mock_http_client(mock_resp)
    with patch("app.services.post_status_service.httpx.AsyncClient", return_value=mock_cm):
        resp = await client.get(
            "/api/v1/post-status?post_id=abc&subreddit=learnpython",
            headers=auth_headers,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "visible"
    assert data["visible_to_public"] is True
    assert data["cached"] is False
    assert data["reason_hint"] is None


async def test_post_status_deleted_by_author(client, auth_headers):
    mock_resp = make_reddit_response({"author": "[deleted]", "removed_by_category": None})
    mock_cm = make_mock_http_client(mock_resp)
    with patch("app.services.post_status_service.httpx.AsyncClient", return_value=mock_cm):
        resp = await client.get(
            "/api/v1/post-status?post_id=abc&subreddit=learnpython",
            headers=auth_headers,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "removed"
    assert data["visible_to_public"] is False
    assert data["reason_hint"] == "deleted_by_author"


async def test_post_status_removed(client, auth_headers):
    mock_resp = make_reddit_response(
        {"author": "someuser", "removed_by_category": "moderator"}
    )
    mock_cm = make_mock_http_client(mock_resp)
    with patch("app.services.post_status_service.httpx.AsyncClient", return_value=mock_cm):
        resp = await client.get(
            "/api/v1/post-status?post_id=abc&subreddit=learnpython",
            headers=auth_headers,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "removed"
    assert data["visible_to_public"] is False
    assert data["reason_hint"] == "missing_from_listing"


async def test_post_status_fetch_failed(client, auth_headers):
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(side_effect=Exception("network error"))
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    with patch("app.services.post_status_service.httpx.AsyncClient", return_value=mock_cm):
        resp = await client.get(
            "/api/v1/post-status?post_id=abc&subreddit=learnpython",
            headers=auth_headers,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "unknown"
    assert data["visible_to_public"] is False
    assert data["reason_hint"] == "fetch_failed"


async def test_post_status_rate_limited(client, auth_headers):
    mock_resp = make_reddit_response({"author": "someuser", "removed_by_category": None})
    mock_cm = make_mock_http_client(mock_resp)
    with patch("app.services.post_status_service.httpx.AsyncClient", return_value=mock_cm):
        for i in range(10):
            resp = await client.get(
                f"/api/v1/post-status?post_id=post{i}&subreddit=learnpython",
                headers=auth_headers,
            )
            assert resp.status_code == 200, f"Request {i+1} should succeed, got {resp.status_code}"

        # 11th request should be rate limited
        resp = await client.get(
            "/api/v1/post-status?post_id=post_extra&subreddit=learnpython",
            headers=auth_headers,
        )
    assert resp.status_code == 429
