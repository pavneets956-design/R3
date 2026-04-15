import os
import pytest
from httpx import AsyncClient, ASGITransport

# Set env before app import so config.py reads them
os.environ.setdefault("REDDIT_CLIENT_ID", "test-client-id")
os.environ.setdefault("REDDIT_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("LICENSE_MODE", "stub")

from app.main import app  # noqa: E402

@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

@pytest.fixture
def auth_headers():
    # Valid UUID v4 format (matches ExtPay api_key shape). Stub mode accepts any non-empty UUID.
    return {"Authorization": "Bearer a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"}
