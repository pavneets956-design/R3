import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.license_service import validate_license
from app.cache import TTLCache

# A valid UUID v4 api_key (format ExtPay uses)
PAID_KEY = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
FREE_KEY = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"
BAD_KEY = "not-a-valid-uuid"


@pytest.mark.asyncio
async def test_paid_api_key_returns_true():
    """ExtensionPay says paid=true → returns True, caches 15min"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"paid": True}

    with patch("app.services.license_service.httpx.AsyncClient") as mock_client_cls, \
         patch("app.services.license_service.settings") as mock_settings, \
         patch("app.services.license_service.cache", new_callable=TTLCache):
        mock_settings.license_mode = "extensionpay"
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        result = await validate_license(PAID_KEY)
        assert result is True

        # Verify the right URL and query param were used
        call_kwargs = mock_client.get.call_args
        assert "api_key" in call_kwargs.kwargs.get("params", {})
        assert call_kwargs.kwargs["params"]["api_key"] == PAID_KEY


@pytest.mark.asyncio
async def test_unpaid_api_key_returns_false():
    """ExtensionPay says paid=false → returns False, not cached"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"paid": False}

    with patch("app.services.license_service.httpx.AsyncClient") as mock_client_cls, \
         patch("app.services.license_service.settings") as mock_settings, \
         patch("app.services.license_service.cache", new_callable=TTLCache):
        mock_settings.license_mode = "extensionpay"
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        result = await validate_license(FREE_KEY)
        assert result is False


@pytest.mark.asyncio
async def test_malformed_api_key_returns_false_without_http_call():
    """Malformed api_key → False immediately, no HTTP call to ExtensionPay"""
    with patch("app.services.license_service.httpx.AsyncClient") as mock_client_cls, \
         patch("app.services.license_service.settings") as mock_settings:
        mock_settings.license_mode = "extensionpay"

        result = await validate_license(BAD_KEY)
        assert result is False
        mock_client_cls.assert_not_called()


@pytest.mark.asyncio
async def test_extensionpay_down_raises():
    """ExtensionPay API unreachable → raises LicenseServiceError"""
    import httpx
    from app.services.license_service import LicenseServiceError

    with patch("app.services.license_service.httpx.AsyncClient") as mock_client_cls, \
         patch("app.services.license_service.settings") as mock_settings, \
         patch("app.services.license_service.cache", new_callable=TTLCache):
        mock_settings.license_mode = "extensionpay"
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("timeout"))
        mock_client_cls.return_value = mock_client

        with pytest.raises(LicenseServiceError):
            await validate_license(PAID_KEY)


@pytest.mark.asyncio
async def test_stub_mode_always_valid():
    """In stub mode, any non-empty api_key is treated as paid"""
    from app.services.license_service import validate_license_stub
    assert await validate_license_stub(PAID_KEY) is True


@pytest.mark.asyncio
async def test_empty_api_key_returns_false():
    """Empty api_key → False without calling ExtensionPay"""
    result = await validate_license("")
    assert result is False
