"""
Campaign-scoped realtime notifications (SSE).

Local single-process: in-memory queues.
Production (REDIS_URL / CHANNEL_REDIS configured): Redis pub/sub. Fail loud —
never silently fall back to in-process when Redis is configured, or worker B
drops events and auto-apply sheets go stale.
"""

from __future__ import annotations

import json
import logging
import os
import queue
import threading
from collections import defaultdict
from typing import Any, DefaultDict, Dict, List, Optional

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_subscribers: DefaultDict[int, List[queue.Queue]] = defaultdict(list)

_redis_client = None
_redis_init_attempted = False
_redis_required = False
CHANNEL_PREFIX = "bizarre:campaign:"


def _redis_url() -> Optional[str]:
    return (
        os.environ.get("REDIS_URL")
        or os.environ.get("CHANNEL_REDIS_URL")
        or os.environ.get("CELERY_BROKER_URL")
    )


def _use_redis() -> bool:
    """True when an explicit Redis URL is configured."""
    url = _redis_url()
    if not url:
        return False
    # Skip placeholder defaults in local-only settings unless FORCE_REDIS_PUBSUB=1.
    if os.environ.get("FORCE_REDIS_PUBSUB", "").lower() in ("1", "true", "yes"):
        return True
    # Production settings / gunicorn: treat any REDIS_URL as required.
    if os.environ.get("DJANGO_SETTINGS_MODULE", "").endswith("settings_prod"):
        return True
    if os.environ.get("BIZARRE_REQUIRE_REDIS_PUBSUB", "").lower() in (
        "1",
        "true",
        "yes",
    ):
        return True
    # Default: if REDIS_URL is set and not the stock localhost celery default
    # alone, still try Redis but allow in-process fallback when ping fails —
    # unless BIZARRE_REQUIRE_REDIS_PUBSUB is set (prod).
    return bool(url)


def get_redis_client():
    """Return a live Redis client or None when Redis is not configured."""
    global _redis_client, _redis_init_attempted, _redis_required
    if _redis_init_attempted:
        return _redis_client
    _redis_init_attempted = True
    url = _redis_url()
    require = (
        os.environ.get("DJANGO_SETTINGS_MODULE", "").endswith("settings_prod")
        or os.environ.get("BIZARRE_REQUIRE_REDIS_PUBSUB", "").lower()
        in ("1", "true", "yes")
        or os.environ.get("FORCE_REDIS_PUBSUB", "").lower() in ("1", "true", "yes")
    )
    _redis_required = require and bool(url)
    if not url:
        return None
    try:
        import redis  # type: ignore

        client = redis.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        _redis_client = client
        logger.info("Realtime pub/sub using Redis at %s", url.split("@")[-1])
        return _redis_client
    except Exception as exc:
        if _redis_required:
            raise RuntimeError(
                f"Redis pub/sub required but unavailable ({url!r}): {exc}. "
                "Set a working REDIS_URL or unset BIZARRE_REQUIRE_REDIS_PUBSUB "
                "for local single-process."
            ) from exc
        logger.warning(
            "Redis pub/sub unavailable (%s); using in-process SSE fanout.",
            exc,
        )
        _redis_client = None
        return None


def subscribe_campaign(campaign_id: int) -> queue.Queue:
    q: queue.Queue = queue.Queue()
    with _lock:
        _subscribers[campaign_id].append(q)
    # Also subscribe Redis → local queue in a background thread when configured.
    client = get_redis_client()
    if client is not None:
        _ensure_redis_listener(campaign_id, q, client)
    return q


_listener_threads: Dict[int, threading.Thread] = {}
_listener_queues: DefaultDict[int, List[queue.Queue]] = defaultdict(list)


def _ensure_redis_listener(campaign_id: int, q: queue.Queue, client) -> None:
    with _lock:
        _listener_queues[campaign_id].append(q)
        if campaign_id in _listener_threads and _listener_threads[campaign_id].is_alive():
            return

        def _run():
            pubsub = client.pubsub(ignore_subscribe_messages=True)
            channel = f"{CHANNEL_PREFIX}{campaign_id}"
            pubsub.subscribe(channel)
            try:
                for message in pubsub.listen():
                    if message is None or message.get("type") != "message":
                        continue
                    raw = message.get("data")
                    try:
                        if isinstance(raw, bytes):
                            raw = raw.decode("utf-8")
                        payload = json.loads(raw)
                    except Exception:
                        payload = {
                            "type": "campaign_update",
                            "reason": "update",
                        }
                    with _lock:
                        targets = list(_listener_queues.get(campaign_id, []))
                    for target in targets:
                        try:
                            target.put_nowait(payload)
                        except queue.Full:
                            pass
            finally:
                try:
                    pubsub.close()
                except Exception:
                    pass

        t = threading.Thread(
            target=_run,
            name=f"sse-redis-{campaign_id}",
            daemon=True,
        )
        _listener_threads[campaign_id] = t
        t.start()


def unsubscribe_campaign(campaign_id: int, q: queue.Queue) -> None:
    with _lock:
        subs = _subscribers.get(campaign_id)
        if subs:
            try:
                subs.remove(q)
            except ValueError:
                pass
            if not subs:
                del _subscribers[campaign_id]
        lq = _listener_queues.get(campaign_id)
        if lq:
            try:
                lq.remove(q)
            except ValueError:
                pass
            if not lq:
                del _listener_queues[campaign_id]


def broadcast_campaign_update(campaign_id: int, reason: str = "") -> None:
    """Notify all SSE clients watching this campaign (Redis and/or in-process)."""
    payload: Dict[str, Any] = {
        "type": "campaign_update",
        "reason": reason or "update",
    }
    client = get_redis_client()
    if client is not None:
        channel = f"{CHANNEL_PREFIX}{campaign_id}"
        client.publish(channel, json.dumps(payload))
        return
    with _lock:
        for q in list(_subscribers.get(campaign_id, [])):
            try:
                q.put_nowait(payload)
            except queue.Full:
                pass
