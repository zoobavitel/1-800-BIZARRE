"""Normalize NPC.crew_standing: clamp −3..+3 and drop unknown crew keys."""


def normalize_crew_standing(raw, *, valid_crew_ids=None):
    """
    Return a dict of {str(crew_id): int in [-3, 3]}.

    If valid_crew_ids is provided (iterable of ints), drop keys not in that set.
    Non-dict / unparseable values become {}.
    """
    if not isinstance(raw, dict):
        return {}
    allowed = None
    if valid_crew_ids is not None:
        allowed = {str(int(x)) for x in valid_crew_ids if x is not None}
    out = {}
    for key, value in raw.items():
        sk = str(key).strip()
        if not sk:
            continue
        try:
            int(sk)  # must be numeric id string
        except (TypeError, ValueError):
            continue
        if allowed is not None and sk not in allowed:
            continue
        try:
            n = int(value)
        except (TypeError, ValueError):
            continue
        out[sk] = max(-3, min(3, n))
    return out
