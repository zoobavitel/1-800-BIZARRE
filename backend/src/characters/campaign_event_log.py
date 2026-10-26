"""
Numbered campaign events, kept briefly so a reconnecting stream can replay.

Every ``broadcast_campaign_update`` appends its payload here and gets an id.
The id goes out with the live event (``"id"`` in the JSON and an SSE ``id:``
line). A client that reconnects sends the last id it saw as
``?last_event_id=`` and the stream first replays what it missed.

With Redis this is a Redis Stream per campaign: ``XADD`` with
``MAXLEN ~ MAX_EVENTS``, and the key expires ``IDLE_SECONDS`` after the last
event. Without Redis (dev, tests) it is an in-process buffer with the same
rules. Ids look like Redis stream ids (``<ms>-<seq>``) either way.

A replay is only safe when nothing between the client's id and now was
trimmed. That holds when the client's id is still in the buffer. Otherwise
(trimmed, expired, unknown or malformed id) the stream says ``resync`` and the
client refetches everything, as it did before replay existed.

Logging is best effort: a failure here never stops the live event, which then
goes out without an id.
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

MAX_EVENTS = 500
IDLE_SECONDS = 3600

_ID_RE = re.compile(r"^(\d+)-(\d+)$")

_lock = threading.Lock()
# campaign_id -> (events, last_append_monotonic, next_seq)
_local: Dict[int, Tuple[Deque[Dict[str, Any]], float, int]] = {}


def stream_key(campaign_id: int) -> str:
    from django.conf import settings

    prefix = getattr(settings, "REALTIME_CHANNEL_PREFIX", "bizarre:campaign:")
    return f"{prefix}{campaign_id}:events"


def parse_event_id(event_id: Any) -> Optional[Tuple[int, int]]:
    if not isinstance(event_id, str):
        return None
    m = _ID_RE.match(event_id.strip())
    if not m:
        return None
    return (int(m.group(1)), int(m.group(2)))


def _redis():
    from .realtime import get_redis_client

    return get_redis_client()


def reset_local_log() -> None:
    """Tests: forget the in-process buffers."""
    with _lock:
        _local.clear()


def append_event(campaign_id: int, payload: Dict[str, Any]) -> Optional[str]:
    """Store ``payload`` and return its id, or None when logging failed."""
    client = _redis()
    if client is not None:
        try:
            key = stream_key(campaign_id)
            raw_id = client.xadd(
                key,
                {"p": json.dumps(payload)},
                maxlen=MAX_EVENTS,
                approximate=True,
            )
            client.expire(key, IDLE_SECONDS)
            return raw_id.decode() if isinstance(raw_id, bytes) else str(raw_id)
        except Exception as exc:
            logger.warning("campaign event log append failed campaign=%s: %s", campaign_id, exc)
            return None
    now = time.monotonic()
    with _lock:
        events, last_at, seq = _local.get(campaign_id, (deque(), now, 0))
        if now - last_at > IDLE_SECONDS:
            events = deque()
        seq += 1
        event_id = f"0-{seq}"
        events.append({**payload, "id": event_id})
        while len(events) > MAX_EVENTS:
            events.popleft()
        _local[campaign_id] = (events, now, seq)
    return event_id


def newest_id(campaign_id: int) -> Optional[str]:
    """The id of the newest kept event, or None when the log is empty or unreadable.

    Sent to the client as its cursor on connect and on resync, so a tab that
    has seen no events, or whose id fell out of the log, resumes from a valid
    id instead of resyncing on every reconnect.
    """
    client = _redis()
    if client is not None:
        try:
            newest = client.xrevrange(stream_key(campaign_id), max="+", min="-", count=1)
            return _decode(newest[0][0]) if newest else None
        except Exception as exc:
            logger.warning("campaign event log newest failed campaign=%s: %s", campaign_id, exc)
            return None
    now = time.monotonic()
    with _lock:
        entry = _local.get(campaign_id)
        if entry is None:
            return None
        events, last_at, _seq = entry
        if now - last_at > IDLE_SECONDS or not events:
            return None
        return events[-1]["id"]


def events_since(campaign_id: int, last_id: Any) -> Optional[List[Dict[str, Any]]]:
    """Events after ``last_id``, oldest first; None when a replay can't be trusted."""
    last = parse_event_id(last_id)
    if last is None:
        return None
    client = _redis()
    if client is not None:
        try:
            key = stream_key(campaign_id)
            oldest = client.xrange(key, min="-", max="+", count=1)
            if not oldest:
                return None
            oldest_key = parse_event_id(_decode(oldest[0][0]))
            if oldest_key is None or oldest_key > last:
                return None
            out = []
            for raw_id, fields in client.xrange(key, min=f"({last_id.strip()}", max="+"):
                event = _decode_fields(fields)
                if event is None:
                    continue
                event["id"] = _decode(raw_id)
                out.append(event)
            return out
        except Exception as exc:
            logger.warning("campaign event log replay failed campaign=%s: %s", campaign_id, exc)
            return None
    now = time.monotonic()
    with _lock:
        entry = _local.get(campaign_id)
        if entry is None:
            return None
        events, last_at, _seq = entry
        if now - last_at > IDLE_SECONDS or not events:
            return None
        if parse_event_id(events[0]["id"]) > last:
            return None
        return [dict(e) for e in events if parse_event_id(e["id"]) > last]


def _decode(value: Any) -> str:
    return value.decode() if isinstance(value, bytes) else str(value)


def _decode_fields(fields: Dict[Any, Any]) -> Optional[Dict[str, Any]]:
    raw = fields.get(b"p", fields.get("p"))
    if raw is None:
        return None
    try:
        return json.loads(_decode(raw))
    except (TypeError, ValueError):
        return None
