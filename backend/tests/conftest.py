import os
import pytest
from httpx import AsyncClient, ASGITransport

# Set env before app import so config.py reads them
os.environ.setdefault("REDDIT_CLIENT_ID", "test-client-id")
os.environ.setdefault("REDDIT_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("LICENSE_MODE", "stub")
os.environ.setdefault("DEV_TOKEN", "test-token")

from app.main import app  # noqa: E402

@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test-token"}
