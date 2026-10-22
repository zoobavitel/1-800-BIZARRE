"""Turn image URLs that point at our own uploaded media back into file references.

A frontend bug echoed the API's absolute media URL (for example
https://bizarre-api.tailb65341.ts.net/media/npc_images/x.webp) back as
``image_url``. The serializer then cleared the uploaded file and stored the
URL, pinning the row to that host. Moving the API to a new host would break
those portraits, so restore the file reference and clear the link.

Hosts are listed here so the migration does not depend on settings. Reverse
is a no-op: the restored rows are what the data should have been.
"""

import logging
from urllib.parse import unquote, urlsplit

from django.core.files.storage import default_storage
from django.db import migrations

logger = logging.getLogger(__name__)

OWN_HOSTS = {
    "bizarre-api.tailb65341.ts.net",
    "api.1-800-bizarre.com",
    # ngrok tunnel used before Funnel; prod had 3 NPCs pinned to it (2026-10-21).
    "roger-premunicipal-branden.ngrok-free.dev",
    "bizarre-api",
    "192.168.1.204",
    "localhost",
    "127.0.0.1",
}
MEDIA_PREFIX = "/media/"

TARGETS = [
    ("Faction", "image", "image_url"),
    ("Crew", "image", "image_url"),
    ("NPC", "image", "image_url"),
    ("Character", "image", "image_url"),
    ("UserProfile", "avatar", "avatar_url"),
]


def _media_name(url):
    s = (url or "").strip()
    if not s:
        return None
    parts = urlsplit(s)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return None
    if parts.hostname.lower() not in OWN_HOSTS:
        return None
    path = unquote(parts.path or "")
    if not path.startswith(MEDIA_PREFIX):
        return None
    name = path[len(MEDIA_PREFIX) :]
    if not name or ".." in name.split("/"):
        return None
    return name


def unpin(apps, schema_editor):
    for model_name, file_field, url_field in TARGETS:
        Model = apps.get_model("characters", model_name)
        fixed = 0
        for row in Model.objects.exclude(**{url_field: ""}).filter(
            **{f"{url_field}__contains": MEDIA_PREFIX}
        ):
            name = _media_name(getattr(row, url_field))
            if not name:
                continue
            current = getattr(row, file_field)
            if current and current.name:
                # A file is already set; only drop the redundant pinned link.
                setattr(row, url_field, "")
            else:
                try:
                    exists = default_storage.exists(name)
                except Exception:  # noqa: BLE001 - leave row untouched
                    exists = False
                if not exists:
                    continue
                setattr(row, file_field, name)
                setattr(row, url_field, "")
            row.save(update_fields=[file_field, url_field])
            fixed += 1
        if fixed:
            logger.warning(
                "unpin_own_media_urls: %s rows fixed on %s", fixed, model_name
            )


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0129_npc_faction_section_visibility"),
    ]

    operations = [
        migrations.RunPython(unpin, migrations.RunPython.noop),
    ]
