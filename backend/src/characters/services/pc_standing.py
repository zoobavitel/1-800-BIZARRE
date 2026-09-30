"""Normalize standing maps (NPC.pc_standing / Character.npc_standing): clamp −3..+3."""


def normalize_pc_standing(raw, *, valid_character_ids=None, valid_ids=None):
    """
    Return a dict of {str(id): int in [-3, 3]}.

    Used for NPC.pc_standing (character ids) and Character.npc_standing (NPC ids).
    If valid_ids or valid_character_ids is provided (iterable of ints), drop keys
    not in that set. Non-dict / unparseable values become {}.
    """
    if not isinstance(raw, dict):
        return {}
    allowed = None
    id_source = valid_ids if valid_ids is not None else valid_character_ids
    if id_source is not None:
        allowed = {str(int(x)) for x in id_source if x is not None}
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
