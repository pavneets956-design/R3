import time
import pytest
from app.cache import TTLCache, RateLimiter


class TestTTLCache:
    def test_miss_returns_none(self):
        c = TTLCache()
        assert c.get("missing") is None

    def test_set_and_get(self):
        c = TTLCache()
        c.set("k", "v", ttl_seconds=60)
        assert c.get("k") == "v"

    def test_expired_returns_none(self):
        c = TTLCache()
        c.set("k", "v", ttl_seconds=0)
        time.sleep(0.01)
        assert c.get("k") is None

    def test_invalidate(self):
        c = TTLCache()
        c.set("k", "v", ttl_seconds=60)
        c.invalidate("k")
        assert c.get("k") is None


class TestRateLimiter:
    def test_allows_first_request(self):
        rl = RateLimiter()
        allowed, retry_after = rl.check("key", max_requests=5, window_seconds=10)
        assert allowed is True
        assert retry_after == 0

    def test_blocks_after_limit(self):
        rl = RateLimiter()
        for _ in range(3):
            rl.check("key", max_requests=3, window_seconds=10)
        allowed, retry_after = rl.check("key", max_requests=3, window_seconds=10)
        assert allowed is False
        assert retry_after > 0

    def test_different_keys_are_independent(self):
        rl = RateLimiter()
        for _ in range(3):
            rl.check("key-a", max_requests=3, window_seconds=10)
        allowed, _ = rl.check("key-b", max_requests=3, window_seconds=10)
        assert allowed is True
