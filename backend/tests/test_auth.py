import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


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


def test_unpaid_email_returns_403():
    with patch("app.services.license_service.httpx.AsyncClient") as cls, \
         patch("app.services.license_service.settings") as mock_settings, \
         patch("app.services.license_service.cache") as mock_cache:
        mock_settings.license_mode = "extensionpay"
        mock_settings.extensionpay_secret_key = "test-key"
        mock_cache.get.return_value = None
        cls.return_value = _mock_extpay_client(paid=False)
        resp = client.get(
            "/api/v1/post-status?post_id=abc123&subreddit=python",
            headers={"Authorization": "Bearer free@example.com"},
        )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"] == "pro_license_required"


def test_extensionpay_down_returns_503():
    import httpx
    with patch("app.services.license_service.httpx.AsyncClient") as cls, \
         patch("app.services.license_service.settings") as mock_settings, \
         patch("app.services.license_service.cache") as mock_cache:
        mock_settings.license_mode = "extensionpay"
        mock_settings.extensionpay_secret_key = "test-key"
        mock_cache.get.return_value = None
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("down"))
        cls.return_value = mock_client
        resp = client.get(
            "/api/v1/post-status?post_id=abc123&subreddit=python",
            headers={"Authorization": "Bearer user@example.com"},
        )
    assert resp.status_code == 503
    assert resp.json()["detail"]["error"] == "license_service_unavailable"
