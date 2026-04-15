async def test_license_valid_dev_token(client, auth_headers):
    resp = await client.get("/api/v1/license", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert data["plan"] == "pro"
    assert data["expires_at"] is None
    assert data["features"]["risk"] is True
    assert data["features"]["post_status"] is True


async def test_license_missing_token(client):
    resp = await client.get("/api/v1/license")
    assert resp.status_code == 401
    assert resp.json()["detail"]["error"] == "unauthorized"


async def test_license_wrong_token(client):
    resp = await client.get(
        "/api/v1/license",
        headers={"Authorization": "Bearer not-the-dev-token"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"]["error"] == "unauthorized"
