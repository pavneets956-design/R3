import math
import time
from typing import Any


class TTLCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        self._store[key] = (value, time.time() + ttl_seconds)

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)


class RateLimiter:
    def __init__(self) -> None:
        self._windows: dict[str, list[float]] = {}

    def check(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        """Returns (allowed, retry_after_seconds). Records the request if allowed."""
        now = time.time()
        timestamps = [t for t in self._windows.get(key, []) if now - t < window_seconds]

        if len(timestamps) >= max_requests:
            oldest = timestamps[0]
            retry_after = math.ceil(window_seconds - (now - oldest))
            self._windows[key] = timestamps
            return False, retry_after

        timestamps.append(now)
        self._windows[key] = timestamps
        return True, 0


# Module-level singletons used by routes
cache = TTLCache()
rate_limiter = RateLimiter()
