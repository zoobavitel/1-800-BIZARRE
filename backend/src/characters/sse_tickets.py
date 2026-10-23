"""
One-use tickets for opening a campaign SSE stream.

EventSource cannot send an Authorization header, so the stream URL used to
carry the login token (``?token=``), and the access log recorded it. Now the
client first POSTs (with its normal token header) for a ticket, then opens the
stream with ``?ticket=``. A ticket is bound to one user and one campaign, lives
``SSE_TICKET_TTL_SECONDS`` (60 s), and works once, so a logged URL is useless.

Tickets live in Redis when realtime uses Redis, so any gunicorn worker can
redeem them; otherwise they live in process memory (dev and tests).
"""

from __future__ import annotations

import logging
import secrets
import threading
import time
from typing import Dict, Optional, Tuple

from django.conf import settings

from .realtime import get_redis_client

logger = logging.getLogger(__name__)

_lock = threading.Lock()
# ticket -> (user_id, campaign_id, expires_at monotonic)
_local_tickets: Dict[str, Tuple[int, int, float]] = {}


def ticket_ttl_seconds() -> int:
    return max(1, int(getattr(settings, "SSE_TICKET_TTL_SECONDS", 60)))


def _key(ticket: str) -> str:
    prefix = getattr(settings, "REALTIME_CHANNEL_PREFIX", "bizarre:campaign:")
    return f"{prefix}sse-ticket:{ticket}"


def issue_ticket(user_id: int, campaign_id: int) -> str:
    """Store a new ticket for this user and campaign and return it."""
    ticket = secrets.token_urlsafe(32)
    ttl = ticket_ttl_seconds()
    client = get_redis_client()
    if client is not None:
        client.set(_key(ticket), f"{int(user_id)}:{int(campaign_id)}", ex=ttl)
        return ticket
    now = time.monotonic()
    with _lock:
        # Drop expired tickets so the dict cannot grow without bound.
        for stale in [k for k, v in _local_tickets.items() if v[2] <= now]:
            del _local_tickets[stale]
        _local_tickets[ticket] = (int(user_id), int(campaign_id), now + ttl)
    return ticket


def redeem_ticket(ticket: str) -> Optional[Tuple[int, int]]:
    """Consume a ticket. Returns (user_id, campaign_id), or None if unknown,
    expired or already used."""
    if not ticket:
        return None
    client = get_redis_client()
    if client is not None:
        try:
            raw = client.getdel(_key(ticket))
        except Exception:  # noqa: BLE001 - fail closed: no stream without a ticket
            logger.warning("sse ticket redeem failed", exc_info=True)
            return None
        if raw is None:
            return None
        if isinstance(raw, bytes):
            raw = raw.decode()
        try:
            uid, cid = raw.split(":", 1)
            return int(uid), int(cid)
        except ValueError:
            return None
    with _lock:
        entry = _local_tickets.pop(ticket, None)
    if entry is None or entry[2] <= time.monotonic():
        return None
    return entry[0], entry[1]
