"""Shared dice roll helpers: effect normalization and desperate action XP."""

from .models import ExperienceTracker


EFFECT_ORDER = ['limited', 'standard', 'extreme']


def normalize_position(raw):
    p = (raw or 'risky').lower()
    if p in ('controlled', 'risky', 'desperate'):
        return p
    return 'risky'


def normalize_effect(raw):
    """Map API/legacy values to limited | standard | extreme."""
    if not raw:
        return 'standard'
    e = str(raw).strip().lower()
    if e in ('great', 'greater'):
        return 'extreme'
    if e in EFFECT_ORDER:
        return e
    return 'standard'


def bump_effect(effect, steps):
    """Move effect tier by integer steps (can be negative)."""
    eff = normalize_effect(effect)
    if eff not in EFFECT_ORDER:
        eff = 'standard'
    i = EFFECT_ORDER.index(eff)
    j = max(0, min(len(EFFECT_ORDER) - 1, i + int(steps)))
    return EFFECT_ORDER[j]


def action_rating_from_action_dots(action_dots, action_name_raw):
    """
    Dot count for rolled action. Persisted `action_dots` may use `attune` (BitD name) while
    clients send roll `action` as `bizarre`; treat them as the same stat.
    """
    an = str(action_name_raw or "").strip().lower()
    if not an:
        return 0
    ad = action_dots or {}
    keys = [an]
    if an == "bizarre":
        keys.append("attune")
    elif an == "attune":
        keys.append("bizarre")

    if isinstance(ad.get("insight"), dict):
        for group in ad.values():
            if not isinstance(group, dict):
                continue
            for k in keys:
                if k in group:
                    return int(group[k] or 0)
        return 0
    for k in keys:
        if k in ad:
            return int(ad.get(k) or 0)
    return 0


def award_desperate_action_xp(character, session, roll, action_name, request_user):
    """
    If this is a desperate ACTION roll with a mappable action name, award 1 XP on the attribute track.
    Returns (xp_awarded: int, xp_track: str|None).
    """
    position = (roll.position or '').lower()
    roll_type = (roll.roll_type or '').upper()
    if position != 'desperate' or roll_type != 'ACTION' or not (action_name or '').strip():
        return 0, None

    action_lower = action_name.lower()
    track = None
    if action_lower in ['hunt', 'study', 'survey', 'tinker']:
        track = 'insight'
    elif action_lower in ['finesse', 'prowl', 'skirmish', 'wreck']:
        track = 'prowess'
    elif action_lower in ['bizarre', 'command', 'consort', 'sway']:
        track = 'resolve'
    if not track:
        return 0, None

    xp_clocks = character.xp_clocks or {}
    current = xp_clocks.get(track, 0)
    if current >= 5:
        return 0, None

    xp_clocks[track] = current + 1
    character.xp_clocks = xp_clocks
    character.save(update_fields=['xp_clocks'])
    ExperienceTracker.objects.create(
        character=character,
        session=session,
        roll=roll,
        trigger='DESPERATE_ROLL',
        description=f'Desperate roll: {action_name}',
        xp_gained=1,
    )
    return 1, track


def tier_die_from_action_pool(
    results, pool_before_roll, pool_action_rating=None
):
    """
    Tier die following SRD: normally highest rolled die.

    When the *final* pool before rolling is 0 **and** the character has **0 dots** in that
    action, the server rolled 2d and the **lower** die counts (FiTD 0‑dice).

    If `pool_before_roll == 0` but `pool_action_rating > 0`, stored data is inconsistent
    (e.g. legacy row); read **max** so a 6 still succeeds.
    """
    if not results:
        return 0
    try:
        pool_int = (
            int(pool_before_roll)
            if pool_before_roll is not None
            else 0
        )
    except (TypeError, ValueError):
        pool_int = 0
    try:
        par = (
            int(pool_action_rating)
            if pool_action_rating is not None
            else None
        )
    except (TypeError, ValueError):
        par = None
    try:
        vals = [int(r) for r in results]
    except (TypeError, ValueError):
        return 0
    if pool_int == 0 and len(vals) >= 2:
        if par is not None and par > 0:
            return max(vals)
        return min(vals)
    return max(vals)


def action_roll_counts_as_failure_for_group(
    results, pool_before_roll, pool_action_rating=None
):
    """Tier 1–3 on the tier die ⇒ counts as failure for group-action leader stress and board."""
    if not results:
        return True
    return (
        tier_die_from_action_pool(
            results, pool_before_roll, pool_action_rating
        )
        <= 3
    )


def outcome_from_action_roll(
    results, pool_before_roll, pool_action_rating=None
):
    """
    SRD-aligned buckets: critical if ≥2 sixes; otherwise 6 = full success, 4–5 = partial with
    consequence, 1–3 = failure (`docs/1(800)-Bizarre SRD.md`: read highest; 4–5 mixed; 1–3 fail).
    For true 0-dot + 0 pool (two dice, take lower), tier uses min(...) after crit check.
    """
    if not results:
        return "FAILURE"
    sixes = sum(1 for r in results if r == 6)
    if sixes >= 2:
        return "CRITICAL_SUCCESS"
    tier = tier_die_from_action_pool(
        results, pool_before_roll, pool_action_rating
    )
    if tier >= 6:
        return "FULL_SUCCESS"
    if tier >= 4:
        return "PARTIAL_SUCCESS"
    return "FAILURE"


def outcome_from_dice_results(results):
    """Highest die + crit if ≥2 sixes (manual fortune/GM roll PATCH; always read max of listed dice)."""
    if not results:
        return "FAILURE"
    sixes = sum(1 for r in results if r == 6)
    if sixes >= 2:
        return "CRITICAL_SUCCESS"
    tier = max(results)
    if tier >= 6:
        return "FULL_SUCCESS"
    if tier >= 4:
        return "PARTIAL_SUCCESS"
    return "FAILURE"
