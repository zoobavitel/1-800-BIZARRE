"""Normalize Faction.faction_status_visibility (peer name → bool)."""


def normalize_faction_status_visibility(raw):
    """
    Return {peer_name: bool}. Missing/invalid → {}.
    Keys trimmed; empty names dropped. Values coerced with bool().
    """
    if not isinstance(raw, dict) or isinstance(raw, list):
        return {}
    out = {}
    for k, v in raw.items():
        if k in ("next", "changed"):
            continue
        name = str(k or "").strip()
        if not name:
            continue
        out[name] = bool(v)
    return out


def peer_standing_visible(visibility_map, peer_name):
    """Missing key defaults to visible (True)."""
    name = str(peer_name or "").strip()
    if not name:
        return False
    vis = normalize_faction_status_visibility(visibility_map)
    if name not in vis:
        return True
    return bool(vis[name])


def redact_faction_status_for_player(status_map, visibility_map):
    """Drop peer standings that are explicitly hidden from players."""
    if not isinstance(status_map, dict):
        return {}
    vis = normalize_faction_status_visibility(visibility_map)
    out = {}
    for k, v in status_map.items():
        name = str(k or "").strip()
        if not name or name in ("next", "changed"):
            continue
        if name in vis and not vis[name]:
            continue
        out[name] = v
    return out
