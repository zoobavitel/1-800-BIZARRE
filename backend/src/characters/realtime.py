"""
In-process pub/sub for campaign-scoped realtime notifications (SSE).

Single-process dev servers deliver events to all subscribers. Multi-worker
production deployments should replace this with Redis pub/sub or similar.
"""

from __future__ import annotations

import queue
import threading
from collections import defaultdict
from typing import Any, DefaultDict, Dict, List

_lock = threading.Lock()
# campaign_id -> list of queue.Queue for SSE subscribers
_subscribers: DefaultDict[int, List[queue.Queue]] = defaultdict(list)


def subscribe_campaign(campaign_id: int) -> queue.Queue:
    q: queue.Queue = queue.Queue()
    with _lock:
        _subscribers[campaign_id].append(q)
    return q


def unsubscribe_campaign(campaign_id: int, q: queue.Queue) -> None:
    with _lock:
        subs = _subscribers.get(campaign_id)
        if not subs:
            return
        try:
            subs.remove(q)
        except ValueError:
            pass
        if not subs:
            del _subscribers[campaign_id]


def broadcast_campaign_update(campaign_id: int, reason: str = "") -> None:
    """Notify all SSE clients watching this campaign."""
    payload: Dict[str, Any] = {"type": "campaign_update", "reason": reason or "update"}
    with _lock:
        for q in list(_subscribers.get(campaign_id, [])):
            try:
                q.put_nowait(payload)
            except queue.Full:
                pass
