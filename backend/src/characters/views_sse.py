"""
Server-Sent Events stream for campaign-scoped updates (position/effect, rolls, character saves).

Clients authenticate with ?token=<DRF token> because EventSource cannot set Authorization headers.
"""

import json
import queue as queue_module

from django.http import HttpResponse, StreamingHttpResponse
from rest_framework.authtoken.models import Token

from .models import Campaign
from .realtime import subscribe_campaign, unsubscribe_campaign


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

    q = subscribe_campaign(int(campaign_id))

    def event_stream():
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                try:
                    msg = q.get(timeout=25)
                    yield f"data: {json.dumps(msg)}\n\n"
                except queue_module.Empty:
                    yield ": heartbeat\n\n"
        finally:
            unsubscribe_campaign(int(campaign_id), q)

    response = StreamingHttpResponse(
        event_stream(),
        content_type="text/event-stream",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
