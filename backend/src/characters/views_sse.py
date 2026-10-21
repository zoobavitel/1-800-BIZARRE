"""
Server-Sent Events stream for campaign-scoped updates (position/effect, rolls, character saves).

Clients authenticate with ?token=<DRF token> because EventSource cannot set Authorization headers.
"""

import json
import logging
import queue as queue_module
import random
import time

from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse
from rest_framework.authtoken.models import Token

from .models import Campaign
from .realtime import subscribe_campaign, unsubscribe_campaign
from .sse_slots import claim_slot, holds_slot, release_slot

logger = logging.getLogger(__name__)


def _user_from_token_query(request):
    key = request.GET.get("token")
    if not key:
        return None
    try:
        return Token.objects.select_related("user").get(key=key).user
    except Token.DoesNotExist:
        return None


def campaign_events_stream(request, campaign_id):
    user = _user_from_token_query(request)
    if not user or not user.is_authenticated:
        return HttpResponse(status=401)

    try:
        campaign = Campaign.objects.get(pk=campaign_id)
    except Campaign.DoesNotExist:
        return HttpResponse(status=404)

    is_gm = campaign.gm_id == user.id
    is_player = campaign.players.filter(pk=user.id).exists()
    if not is_gm and not is_player:
        return HttpResponse(status=403)

    cid = int(campaign_id)
    stream_id = claim_slot(user.id, cid)
    q = subscribe_campaign(cid)

    def event_stream():
        retry_ms = int(getattr(settings, "SSE_CLIENT_RETRY_MS", 2000))
        max_seconds = float(getattr(settings, "SSE_STREAM_MAX_SECONDS", 45))
        heartbeat = float(getattr(settings, "SSE_HEARTBEAT_SECONDS", 15))
        # How often an idle stream checks whether a newer one evicted it.
        slot_check = float(getattr(settings, "SSE_SLOT_CHECK_SECONDS", 5))
        try:
            yield f"retry: {retry_ms}\n\n"
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            # Prod: jitter ~30–55s so tabs do not reconnect as one herd. Tests use tiny max.
            if max_seconds <= 1:
                lifetime = max_seconds
            else:
                lifetime = random.uniform(
                    max(5.0, max_seconds - 15.0),
                    max_seconds + 10.0,
                )
            deadline = time.monotonic() + lifetime
            next_heartbeat = time.monotonic() + heartbeat
            while time.monotonic() < deadline:
                if not holds_slot(user.id, cid, stream_id):
                    # A newer stream from this user replaced this one; free the thread.
                    logger.info("sse evict campaign=%s user=%s", cid, user.id)
                    break
                now = time.monotonic()
                wait = min(next_heartbeat - now, slot_check, deadline - now)
                if wait <= 0:
                    if deadline - now <= 0:
                        break
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                    next_heartbeat = time.monotonic() + heartbeat
                    continue
                try:
                    msg = q.get(timeout=wait)
                    yield f"data: {json.dumps(msg)}\n\n"
                except queue_module.Empty:
                    pass
        finally:
            unsubscribe_campaign(cid, q)
            release_slot(user.id, cid, stream_id)

    response = StreamingHttpResponse(
        event_stream(),
        content_type="text/event-stream",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
