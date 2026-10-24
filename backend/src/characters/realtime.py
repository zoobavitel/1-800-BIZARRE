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
import time
from collections import defaultdict
from typing import Any, DefaultDict, Dict, List, Optional

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_subscribers: DefaultDict[int, List[queue.Queue]] = defaultdict(list)

_redis_client = None
_redis_init_attempted = False
_redis_required = False


def channel_name(campaign_id: int) -> str:
    """Redis pub/sub name. Read at use time so publish and subscribe share one setting."""
    from django.conf import settings

    prefix = getattr(settings, "REALTIME_CHANNEL_PREFIX", "bizarre:campaign:")
    return f"{prefix}{campaign_id}"

_listener_threads: Dict[int, threading.Thread] = {}
_listener_queues: DefaultDict[int, List[queue.Queue]] = defaultdict(list)
_listener_stop: Dict[int, threading.Event] = {}


def _redis_url() -> Optional[str]:
    """Redis URL for pub/sub. Not the Celery broker.

    gunicorn sets BIZARRE_ENV_FILE, not REDIS_URL. settings_prod loads
    REALTIME_REDIS_URL from that file and defaults it to the broker URL.
    Reading only os.environ left both workers on in-process queues, so a
    roll on worker A never reached SSE on worker B.
    """
    explicit = os.environ.get("REALTIME_REDIS_URL")
    if explicit:
        return explicit
    module = os.environ.get("DJANGO_SETTINGS_MODULE", "")
    if module.endswith(("settings_prod", "settings_agent")):
        from django.conf import settings

        configured = getattr(settings, "REALTIME_REDIS_URL", None)
        if configured:
            return configured
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


def _redis_publish_client():
    """Short-timeout client for publish/ping only — not for blocking pub/sub."""
    import redis  # type: ignore

    url = _redis_url()
    return redis.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)


def _redis_pubsub_client():
    """Dedicated blocking client for pub/sub listen (no read timeout)."""
    import redis  # type: ignore

    url = _redis_url()
    return redis.Redis.from_url(
        url,
        socket_connect_timeout=5,
        socket_timeout=None,
    )


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
        client = _redis_publish_client()
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


def _fanout_to_listener_queues(campaign_id: int, payload: Dict[str, Any]) -> None:
    with _lock:
        targets = list(_listener_queues.get(campaign_id, []))
    for target in targets:
        try:
            target.put_nowait(payload)
        except queue.Full:
            pass


def _ensure_redis_listener(campaign_id: int, q: queue.Queue) -> None:
    with _lock:
        _listener_queues[campaign_id].append(q)
        stop = _listener_stop.get(campaign_id)
        if stop is not None:
            stop.clear()
        if (
            campaign_id in _listener_threads
            and _listener_threads[campaign_id].is_alive()
        ):
            return

        stop_event = threading.Event()
        _listener_stop[campaign_id] = stop_event

        def _claim_exit() -> bool:
            """Decide under the lock whether this listener leaves.

            A leaving listener removes itself from the registry in the same
            locked step, so a subscriber that arrives later starts a new one.
            Deciding outside the lock let a subscriber attach to a listener
            that was already on its way out, and that stream got no events.
            """
            me = threading.current_thread()
            with _lock:
                if not stop_event.is_set() and _listener_queues.get(campaign_id):
                    return False
                if _listener_threads.get(campaign_id) is me:
                    _listener_threads.pop(campaign_id, None)
                if _listener_stop.get(campaign_id) is stop_event:
                    _listener_stop.pop(campaign_id, None)
                return True

        def _run() -> None:
            backoff = 1.0
            channel = channel_name(campaign_id)
            # Every exit goes through _claim_exit.
            while not _claim_exit():
                ps_client = None
                pubsub = None
                try:
                    ps_client = _redis_pubsub_client()
                    pubsub = ps_client.pubsub(ignore_subscribe_messages=True)
                    pubsub.subscribe(channel)
                    backoff = 1.0
                    while not _claim_exit():
                        message = pubsub.get_message(
                            ignore_subscribe_messages=True,
                            timeout=1.0,
                        )
                        if message is None:
                            continue
                        if message.get("type") != "message":
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
                        _fanout_to_listener_queues(campaign_id, payload)
                    return
                except Exception as exc:
                    if stop_event.is_set():
                        continue
                    logger.warning(
                        "Redis SSE listener campaign=%s error, reconnecting: %s",
                        campaign_id,
                        exc,
                    )
                    time.sleep(backoff)
                    backoff = min(backoff * 2, 30.0)
                finally:
                    if pubsub is not None:
                        try:
                            pubsub.unsubscribe(channel)
                            pubsub.close()
                        except Exception:
                            pass
                    if ps_client is not None:
                        try:
                            ps_client.close()
                        except Exception:
                            pass

        t = threading.Thread(
            target=_run,
            name=f"sse-redis-{campaign_id}",
            daemon=True,
        )
        _listener_threads[campaign_id] = t
        t.start()


def subscribe_campaign(campaign_id: int) -> queue.Queue:
    q: queue.Queue = queue.Queue()
    with _lock:
        _subscribers[campaign_id].append(q)
        n = sum(len(qs) for qs in _subscribers.values())
        n_c = len(_subscribers[campaign_id])
    logger.info(
        "sse subscribe campaign=%s campaign_queues=%s local_subscribers=%s",
        campaign_id,
        n_c,
        n,
    )
    # Also subscribe Redis → local queue in a background thread when configured.
    if get_redis_client() is not None:
        _ensure_redis_listener(campaign_id, q)
    return q


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
                stop = _listener_stop.get(campaign_id)
                if stop is not None:
                    stop.set()
        n = sum(len(qs) for qs in _subscribers.values())
        n_c = len(_subscribers.get(campaign_id, []))
    logger.info(
        "sse unsubscribe campaign=%s campaign_queues=%s local_subscribers=%s",
        campaign_id,
        n_c,
        n,
    )


def broadcast_campaign_update(
    campaign_id: int,
    reason: str = "",
    character_id: Optional[int] = None,
    session_id: Optional[int] = None,
) -> None:
    """Notify all SSE clients watching this campaign (Redis and/or in-process).

    ``character_id`` / ``session_id`` name the row that changed, so clients can
    refetch only that row instead of every open sheet.
    """
    payload: Dict[str, Any] = {
        "type": "campaign_update",
        "reason": reason or "update",
    }
    if character_id:
        payload["character_id"] = character_id
    if session_id:
        payload["session_id"] = session_id
    client = get_redis_client()
    if client is not None:
        channel = channel_name(campaign_id)
        client.publish(channel, json.dumps(payload))
        return
    with _lock:
        for q in list(_subscribers.get(campaign_id, [])):
            try:
                q.put_nowait(payload)
            except queue.Full:
                pass
