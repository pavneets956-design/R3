import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.license_service import validate_license
from app.cache import TTLCache


@pytest.mark.asyncio
async def test_paid_email_returns_true():
    """ExtensionPay says paid=true → returns True, caches 15min"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"paid": True}

    with patch("app.services.license_service.httpx.AsyncClient") as mock_client_cls, \
         patch("app.services.license_service.settings") as mock_settings, \
         patch("app.services.license_service.cache", new_callable=TTLCache):
        mock_settings.license_mode = "extensionpay"
        mock_settings.extensionpay_secret_key = "test-key"
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        result = await validate_license("user@example.com")
        assert result is True


@pytest.mark.asyncio
async def test_unpaid_email_returns_false():
    """ExtensionPay says paid=false → returns False, not cached"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"paid": False}

    with patch("app.services.license_service.httpx.AsyncClient") as mock_client_cls, \
         patch("app.services.license_service.settings") as mock_settings, \
         patch("app.services.license_service.cache", new_callable=TTLCache):
        mock_settings.license_mode = "extensionpay"
        mock_settings.extensionpay_secret_key = "test-key"
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        result = await validate_license("free@example.com")
        assert result is False


@pytest.mark.asyncio
async def test_extensionpay_down_raises():
    """ExtensionPay API unreachable → raises LicenseServiceError"""
    import httpx
    from app.services.license_service import LicenseServiceError
    from app.cache import TTLCache

    with patch("app.services.license_service.httpx.AsyncClient") as mock_client_cls, \
         patch("app.services.license_service.settings") as mock_settings, \
         patch("app.services.license_service.cache", new_callable=TTLCache):
        mock_settings.license_mode = "extensionpay"
        mock_settings.extensionpay_secret_key = "test-key"
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("timeout"))
        mock_client_cls.return_value = mock_client

        with pytest.raises(LicenseServiceError):
            await validate_license("user@example.com")


@pytest.mark.asyncio
async def test_stub_mode_always_valid():
    """In stub mode, any non-empty email is treated as paid"""
    from app.services.license_service import validate_license_stub
    assert await validate_license_stub("anyone@example.com") is True


@pytest.mark.asyncio
async def test_empty_email_returns_false():
    """Empty email → False without calling ExtensionPay"""
    result = await validate_license("")
    assert result is False
