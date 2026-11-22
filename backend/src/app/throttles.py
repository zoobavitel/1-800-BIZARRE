"""Fixed-window throttles for login and signup.

Counters live in Django's cache. Production points it at Redis (settings_prod
CACHES), so all gunicorn workers share one count. Tests use the default
per-process cache.

Client IP: Caddy proxies every request from Cloudflare to gunicorn on
127.0.0.1, so REMOTE_ADDR is always the proxy. When the request comes from a
trusted proxy (loopback), the client is read from CF-Connecting-IP. Any other
source is trusted as-is, so a client cannot spoof the header from outside.

Failure mode: if the cache is unreachable, the request is allowed and a
warning is logged. A Redis outage must not block sign-in.
"""

from __future__ import annotations

import logging
import time

from django.core.cache import cache
from rest_framework import status
from rest_framework.response import Response

logger = logging.getLogger(__name__)

TRUSTED_PROXIES = {"127.0.0.1", "::1"}


def client_ip(request) -> str:
    remote = request.META.get("REMOTE_ADDR", "") or "unknown"
    if remote in TRUSTED_PROXIES:
        forwarded = request.META.get("HTTP_CF_CONNECTING_IP", "").strip()
        if forwarded:
            return forwarded
    return remote


def _window_key(scope: str, ident: str, window: int) -> str:
    bucket = int(time.time()) // window
    return f"throttle:{scope}:{ident}:{window}:{bucket}"


def is_limited(scope: str, ident: str, limit: int, window: int) -> bool:
    """True when this scope/identity already reached its limit in this window."""
    key = _window_key(scope, ident, window)
    try:
        return int(cache.get(key, 0)) >= limit
    except Exception:  # cache down: fail open
        logger.warning("throttle check skipped (cache unavailable): %s", scope)
        return False


def record(scope: str, ident: str, window: int) -> None:
    """Count one attempt in the current window."""
    key = _window_key(scope, ident, window)
    try:
        if not cache.add(key, 1, timeout=window):
            cache.incr(key)
    except Exception:  # cache down: fail open
        logger.warning("throttle record skipped (cache unavailable): %s", scope)


def too_many_attempts(window: int, message: str) -> Response:
    retry_after = str(window - (int(time.time()) % window))
    response = Response(
        {"detail": message, "message": message},
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )
    response["Retry-After"] = retry_after
    return response


# Login: count failed attempts only. Per IP, and per username so a botnet
# cannot spread guesses across addresses.
LOGIN_WINDOW = 60
LOGIN_LIMIT_PER_IP = 20
LOGIN_LIMIT_PER_USER = 10
LOGIN_MESSAGE = "Too many failed sign-in attempts. Wait a minute and try again."

# Signup: count every attempt, per IP.
SIGNUP_WINDOW = 3600
SIGNUP_LIMIT_PER_IP = 5
SIGNUP_MESSAGE = "Too many sign-up attempts from this network. Try again later."
