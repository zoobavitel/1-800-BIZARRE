"""
Cap live SSE streams per (user, campaign).

Each SSE stream holds a gunicorn thread for its whole life (30–55s). A client
whose connection silently dies (network change, relay drop, sleep) reconnects
while the server still holds the old stream, because the server only learns a
connection is gone when a write fails, and proxies can buffer those writes. One
flapping client held 17 streams at once in prod, enough to starve the thread
pool for every player.

Each new stream claims a slot. When a user holds more than
``SSE_MAX_STREAMS_PER_USER`` streams on one campaign, the oldest loses its slot
and ends at its next check. Slots live in Redis when realtime uses Redis, so the
cap holds across gunicorn workers; otherwise they live in process memory.

Redis errors fail open: a stream is never cut because slot bookkeeping broke.
"""

from __future__ import annotations

import logging
import threading
import uuid
from collections import defaultdict, deque
from typing import Deque, DefaultDict, Tuple

from django.conf import settings

from .realtime import get_redis_client

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_local_slots: DefaultDict[Tuple[int, int], Deque[str]] = defaultdict(deque)


def max_streams() -> int:
    return max(1, int(getattr(settings, "SSE_MAX_STREAMS_PER_USER", 4)))


def _key(user_id: int, campaign_id: int) -> str:
    prefix = getattr(settings, "REALTIME_CHANNEL_PREFIX", "bizarre:campaign:")
    return f"{prefix}{campaign_id}:sse-slots:{user_id}"


def _key_ttl_seconds() -> int:
    # Longer than any stream lives, so a crashed worker's slots expire.
    max_seconds = float(getattr(settings, "SSE_STREAM_MAX_SECONDS", 45))
    return int(max_seconds + 120)


def claim_slot(user_id: int, campaign_id: int) -> str:
    """Register a new stream. Evicts the oldest streams past the cap."""
    stream_id = uuid.uuid4().hex
    limit = max_streams()
    client = get_redis_client()
    if client is not None:
        key = _key(user_id, campaign_id)
        try:
            pipe = client.pipeline()
            pipe.lpush(key, stream_id)
            pipe.ltrim(key, 0, limit - 1)
            pipe.expire(key, _key_ttl_seconds())
            pipe.execute()
        except Exception:  # noqa: BLE001 - fail open
            logger.warning("sse slot claim failed; stream not capped", exc_info=True)
        return stream_id
    with _lock:
        slots = _local_slots[(user_id, campaign_id)]
        slots.appendleft(stream_id)
        while len(slots) > limit:
            slots.pop()
    return stream_id


def holds_slot(user_id: int, campaign_id: int, stream_id: str) -> bool:
    """False once a newer stream from the same user has evicted this one."""
    client = get_redis_client()
    if client is not None:
        try:
            members = client.lrange(_key(user_id, campaign_id), 0, -1)
        except Exception:  # noqa: BLE001 - fail open
            return True
        return any(
            (m.decode() if isinstance(m, bytes) else m) == stream_id for m in members
        )
    with _lock:
        return stream_id in _local_slots.get((user_id, campaign_id), ())


def release_slot(user_id: int, campaign_id: int, stream_id: str) -> None:
    client = get_redis_client()
    if client is not None:
        try:
            client.lrem(_key(user_id, campaign_id), 0, stream_id)
        except Exception:  # noqa: BLE001 - key TTL cleans up
            pass
        return
    with _lock:
        slots = _local_slots.get((user_id, campaign_id))
        if slots is None:
            return
        try:
            slots.remove(stream_id)
        except ValueError:
            pass
        if not slots:
            del _local_slots[(user_id, campaign_id)]
