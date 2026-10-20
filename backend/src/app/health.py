"""Load-balancer health check. Anonymous on purpose.

Caddy on 127.0.0.1:8000 polls this over plain HTTP. Database failure removes
the instance from the pool. Redis failure is reported and does not, because
a Redis blip would otherwise mark every instance down at once.
"""

import os

from django.db import connection
from django.db.utils import Error as DatabaseError
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health(request):
    db_status = "ok"
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        db_status = "down"

    payload = {
        "ok": db_status == "ok",
        "db": db_status,
        "redis": _redis_status(),
        "instance": os.environ.get("BIZARRE_INSTANCE", "single"),
    }
    return JsonResponse(payload, status=200 if payload["ok"] else 503)


def _redis_status():
    from django.conf import settings

    url = getattr(settings, "REALTIME_REDIS_URL", "") or ""
    if not url:
        return "unavailable"
    try:
        import redis
    except ImportError:
        return "unavailable"
    try:
        client = redis.Redis.from_url(
            url, socket_connect_timeout=0.5, socket_timeout=0.5
        )
        client.ping()
    except Exception:
        return "down"
    return "ok"
