import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Valid UUID v4 format api_key (matches ExtPay's format)
PAID_API_KEY = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
FREE_API_KEY = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"
BAD_API_KEY = "not-a-uuid"


def _mock_extpay_client(paid: bool):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"paid": paid}
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.get = AsyncMock(return_value=mock_response)
    return mock_client


def test_missing_auth_returns_401():
    resp = client.get("/api/v1/post-status?post_id=abc123&subreddit=python")
    assert resp.status_code == 401


def test_malformed_auth_returns_401():
    resp = client.get(
        "/api/v1/post-status?post_id=abc123&subreddit=python",
        headers={"Authorization": "NotBearer token"},
    )
    assert resp.status_code == 401


def test_malformed_api_key_returns_403():
    """Non-UUID api_key → 403 (fails format check before HTTP call)"""
    with patch("app.services.license_service.settings") as mock_settings, \
         patch("app.services.license_service.cache") as mock_cache:
        mock_settings.license_mode = "extensionpay"
        mock_cache.get.return_value = None
        resp = client.get(
            "/api/v1/post-status?post_id=abc123&subreddit=python",
            headers={"Authorization": f"Bearer {BAD_API_KEY}"},
        )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"] == "pro_license_required"


def test_unpaid_api_key_returns_403():
    with patch("app.services.license_service.httpx.AsyncClient") as cls, \
         patch("app.services.license_service.settings") as mock_settings, \
         patch("app.services.license_service.cache") as mock_cache:
        mock_settings.license_mode = "extensionpay"
        mock_cache.get.return_value = None
        cls.return_value = _mock_extpay_client(paid=False)
        resp = client.get(
            "/api/v1/post-status?post_id=abc123&subreddit=python",
            headers={"Authorization": f"Bearer {FREE_API_KEY}"},
        )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"] == "pro_license_required"


def test_extensionpay_down_returns_503():
    import httpx
    with patch("app.services.license_service.httpx.AsyncClient") as cls, \
         patch("app.services.license_service.settings") as mock_settings, \
         patch("app.services.license_service.cache") as mock_cache:
        mock_settings.license_mode = "extensionpay"
        mock_cache.get.return_value = None
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("down"))
        cls.return_value = mock_client
        resp = client.get(
            "/api/v1/post-status?post_id=abc123&subreddit=python",
            headers={"Authorization": f"Bearer {PAID_API_KEY}"},
        )
    assert resp.status_code == 503
    assert resp.json()["detail"]["error"] == "license_service_unavailable"
