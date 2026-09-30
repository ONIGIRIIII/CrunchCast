"""Per-client rate limiting for the public API - abuse protection without an
extra dependency.

In-memory and per-process: right for the single Render instance this runs
on, but it resets on restart and isn't shared across instances (swap in a
shared store like Redis if the API ever scales out).
"""

import math
import time
from collections import deque

from starlette.requests import Request


class RateLimiter:
    """Sliding window: at most `limit` requests per `window` seconds for each
    client key. A limit of 0 or less disables limiting."""

    def __init__(self, limit: int, window: float = 60.0):
        self.limit = limit
        self.window = window
        self._hits: dict[str, deque[float]] = {}
        self._last_sweep = 0.0

    def check(self, key: str, now: float | None = None) -> float:
        """Record a request from `key`. Returns 0 if it's allowed, otherwise
        the number of seconds until that client can try again. Rejected
        requests aren't counted, so a blocked client isn't locked out any
        longer than the window itself."""
        if self.limit <= 0:
            return 0.0
        now = time.monotonic() if now is None else now
        cutoff = now - self.window
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= cutoff:
            hits.popleft()
        if len(hits) >= self.limit:
            return hits[0] + self.window - now
        hits.append(now)
        self._sweep(now)
        return 0.0

    def _sweep(self, now: float) -> None:
        # Once per window, forget clients with no recent requests, so memory
        # stays proportional to active clients rather than everyone ever seen.
        if now - self._last_sweep < self.window:
            return
        self._last_sweep = now
        cutoff = now - self.window
        for key in [k for k, hits in self._hits.items() if not hits or hits[-1] <= cutoff]:
            del self._hits[key]


def client_key(request: Request) -> str:
    """Best-effort client IP. Behind Render's proxy the socket address is the
    proxy's, so use the first X-Forwarded-For hop when present. That header
    can be spoofed by a determined client, so this stops casual hammering and
    naive scripts rather than a deliberate attacker."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


def retry_after_seconds(wait: float) -> int:
    return max(1, math.ceil(wait))
