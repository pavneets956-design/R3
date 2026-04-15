import pytest
from unittest.mock import patch, MagicMock
from app.praw_client import get_reddit_client


def test_returns_singleton():
    """get_reddit_client returns the same instance on repeated calls."""
    with patch("app.praw_client.praw.Reddit") as mock_reddit_cls:
        mock_reddit_cls.return_value = MagicMock()
        import app.praw_client as pc
        pc._reddit = None

        c1 = get_reddit_client()
        c2 = get_reddit_client()

    assert c1 is c2
    assert mock_reddit_cls.call_count == 1


def test_uses_config_credentials():
    with patch("app.praw_client.praw.Reddit") as mock_reddit_cls:
        import app.praw_client as pc
        pc._reddit = None
        get_reddit_client()

    _, kwargs = mock_reddit_cls.call_args
    assert kwargs["client_id"] == "test-client-id"
    assert kwargs["client_secret"] == "test-client-secret"
