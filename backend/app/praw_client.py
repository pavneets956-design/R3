import praw
from app.config import settings

_reddit: praw.Reddit | None = None


def get_reddit_client() -> praw.Reddit:
    """Return the module-level PRAW read-only client. Initializes on first call."""
    global _reddit
    if _reddit is None:
        _reddit = praw.Reddit(
            client_id=settings.reddit_client_id,
            client_secret=settings.reddit_client_secret,
            user_agent=settings.reddit_user_agent,
        )
    return _reddit
