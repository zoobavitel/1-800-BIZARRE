"""
Server-Sent Events stream for campaign-scoped updates (position/effect, rolls, character saves).

EventSource cannot set Authorization headers. Clients POST to the ticket
endpoint with their normal token header, then open the stream with
?ticket=<one-use ticket> (see sse_tickets.py). The login token is never
accepted in the URL, where access logs would record it.
"""

import json
import logging
import queue as queue_module
import random
import time

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponse, StreamingHttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Campaign
from .realtime import subscribe_campaign, unsubscribe_campaign
from .sse_slots import claim_slot, holds_slot, release_slot
from .sse_tickets import issue_ticket, redeem_ticket

logger = logging.getLogger(__name__)


def _user_from_ticket_query(request, campaign_id):
    """User for a valid ticket issued for this campaign. The ticket is spent
    even when the campaign does not match."""
    redeemed = redeem_ticket(request.GET.get("ticket", ""))
    if redeemed is None:
        return None
    user_id, ticket_campaign_id = redeemed
    if ticket_campaign_id != int(campaign_id):
        return None
    return get_user_model().objects.filter(pk=user_id, is_active=True).first()


def _campaign_access_status(user, campaign_id):
    """None when the user may follow this campaign, else an HTTP status."""
    try:
        campaign = Campaign.objects.get(pk=campaign_id)
    except Campaign.DoesNotExist:
        return 404
    if campaign.gm_id == user.id:
        return None
    if campaign.players.filter(pk=user.id).exists():
        return None
    return 403


@api_view(["POST"])
def campaign_events_ticket(request, campaign_id):
    """Issue a one-use ticket for opening this campaign's event stream."""
    status = _campaign_access_status(request.user, campaign_id)
    if status is not None:
        return Response(status=status)
    ticket = issue_ticket(request.user.id, int(campaign_id))
    response = Response({"ticket": ticket})
    response["Cache-Control"] = "no-store"
    return response


def campaign_events_stream(request, campaign_id):
    user = _user_from_ticket_query(request, campaign_id)
    if not user or not user.is_authenticated:
        return HttpResponse(status=401)

    # Checked again at stream time: the user may have left since the ticket.
    status = _campaign_access_status(user, campaign_id)
    if status is not None:
        return HttpResponse(status=status)

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
