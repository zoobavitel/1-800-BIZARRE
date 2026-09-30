"""Normalize NPC Stand identity flavor fields."""

_VALID_TYPE_KEYS = frozenset(
    {
        "COLONY",
        "AUTOMATIC",
        "TOOLBOUND",
        "FIGHTING",
        "PHENOMENA",
        "SHARED",
        "CONJOINED",
    }
)
_VALID_CONSCIOUSNESS = frozenset("ABCDEF")


def normalize_string_list(raw, *, allowed=None, upper=False):
    """Return de-duplicated non-empty strings; optionally filter / uppercase."""
    if not isinstance(raw, list):
        return []
    out = []
    seen = set()
    for item in raw:
        s = str(item or "").strip()
        if not s:
            continue
        if upper:
            s = s.upper()
        if allowed is not None and s not in allowed:
            continue
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def normalize_stand_identity_types(raw):
    return normalize_string_list(raw, allowed=_VALID_TYPE_KEYS, upper=True)


def normalize_stand_forms(raw):
    return normalize_string_list(raw, allowed=None, upper=False)


def normalize_stand_consciousness(raw):
    s = str(raw or "").strip().upper()
    if s in _VALID_CONSCIOUSNESS:
        return s
    return ""


def normalize_stand_type_custom(raw):
    return str(raw or "").strip()[:100]
