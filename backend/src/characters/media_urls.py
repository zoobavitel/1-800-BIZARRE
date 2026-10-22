"""
Recognize our own uploaded-media URLs.

Uploaded portraits live in a FileField (`image`). `image_url` is for external
links only. A client that echoes the API's absolute media URL back as
`image_url` would otherwise clear the upload and store a hard-coded host
(e.g. the old Tailscale Funnel name), which breaks once that host changes.
"""

from __future__ import annotations

from urllib.parse import unquote, urlsplit

from django.conf import settings
from django.core.files.storage import default_storage

# Public hosts the API has been served from. Kept here (not only in
# ALLOWED_HOSTS) so URLs saved under a retired host are still recognized.
KNOWN_API_HOSTS = frozenset(
    {
        "bizarre-api.tailb65341.ts.net",
        "api.1-800-bizarre.com",
        "roger-premunicipal-branden.ngrok-free.dev",
    }
)


def _own_hosts() -> set[str]:
    hosts = {h.lower() for h in KNOWN_API_HOSTS}
    for h in getattr(settings, "ALLOWED_HOSTS", []) or []:
        h = str(h).strip().lower()
        if h and "*" not in h and not h.startswith("."):
            hosts.add(h)
    return hosts


def media_name_from_url(url: str, hosts, media_url: str = "/media/") -> str | None:
    """Storage name (e.g. ``npc_images/x.webp``) if ``url`` is one of our media URLs."""
    s = (url or "").strip()
    if not s:
        return None
    parts = urlsplit(s)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return None
    if parts.hostname.lower() not in hosts:
        return None
    prefix = media_url if media_url.endswith("/") else media_url + "/"
    path = unquote(parts.path or "")
    if not path.startswith(prefix):
        return None
    name = path[len(prefix) :]
    if not name or ".." in name.split("/"):
        return None
    return name


def own_media_file_name(url: str) -> str | None:
    """Storage name for an existing uploaded file at ``url`` on one of our hosts."""
    name = media_name_from_url(
        url, _own_hosts(), getattr(settings, "MEDIA_URL", "/media/") or "/media/"
    )
    if name is None:
        return None
    try:
        return name if default_storage.exists(name) else None
    except Exception:  # noqa: BLE001 - unknown storage: treat as external
        return None
