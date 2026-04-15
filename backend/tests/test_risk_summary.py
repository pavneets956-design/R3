import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _mock_risk_response(risk_level: str = "medium"):
    from app.models import RiskResponse
    return RiskResponse(
        subreddit="python",
        username="testuser",
        risk_level=risk_level,
        confidence="medium",
        factors=[],
        recommendation="",
        cached=False,
    )


def test_risk_summary_no_auth_required():
    """No Authorization header needed"""
    with patch("app.routes.risk_summary.check_risk", return_value=_mock_risk_response()):
        resp = client.get("/api/v1/risk-summary?subreddit=python&username=testuser")
    assert resp.status_code == 200


def test_risk_summary_returns_level_only():
    """Response contains risk_level but NOT factors or recommendation"""
    with patch("app.routes.risk_summary.check_risk", return_value=_mock_risk_response("high")):
        resp = client.get("/api/v1/risk-summary?subreddit=python&username=testuser")
    data = resp.json()
    assert "risk_level" in data
    assert "factors" not in data
    assert "recommendation" not in data


def test_risk_summary_missing_username_returns_422():
    resp = client.get("/api/v1/risk-summary?subreddit=python")
    assert resp.status_code == 422


def test_risk_summary_subreddit_too_long_returns_422():
    resp = client.get("/api/v1/risk-summary?subreddit=" + "x" * 30 + "&username=u")
    assert resp.status_code == 422
