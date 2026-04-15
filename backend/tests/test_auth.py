import pytest


async def test_missing_auth_header_returns_401(client):
    resp = await client.get("/api/v1/license")
    assert resp.status_code == 401


async def test_wrong_token_returns_401(client):
    resp = await client.get(
        "/api/v1/license",
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert resp.status_code == 401


async def test_valid_dev_token_accepted(client, auth_headers):
    resp = await client.get("/api/v1/license", headers=auth_headers)
    # Should NOT be 401 — either 200 (route exists) or 404 (route not yet registered)
    assert resp.status_code != 401
