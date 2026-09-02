"""Shared dice roll helpers: effect normalization and desperate action XP."""

import random

from .models import ExperienceTracker
from .services.session_xp_settlement import grant_encoded_trigger_xp


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


def recovery_healing_clock_segments(pool_before_roll, dice_results=None):
    """
    Healing-clock segments from a recover roll (mirrors CharacterSheet.rollRecoveryTreatment).
    0 dice: roll 2d and take the lower die's band. Critical = two sixes (only when pool >= 2).
    Bands: critical +5 segments; highest 6 -> +3; 4-5 -> +2; 1-3 -> +1.
    """
    pool = max(0, int(pool_before_roll or 0))
    if pool <= 0:
        dice_results = list(dice_results) if dice_results else []
        if len(dice_results) < 2:
            dice_results = [random.randint(1, 6), random.randint(1, 6)]
        highest = min(int(dice_results[0]), int(dice_results[1]))
        sixes = 0
        critical = False
    else:
        if not dice_results:
            dice_results = [random.randint(1, 6) for _ in range(pool)]
        cleaned = [int(x) for x in dice_results[: pool + 24]]
        if len(cleaned) < pool:
            cleaned.extend(
                random.randint(1, 6) for _ in range(pool - len(cleaned))
            )
        highest = max(cleaned)
        sixes = sum(1 for d in cleaned if int(d) == 6)
        critical = pool >= 2 and sixes >= 2
    if critical:
        segments = 5
    elif highest >= 6:
        segments = 3
    elif highest >= 4:
        segments = 2
    else:
        segments = 1
    band = (
        "critical"
        if critical
        else ("6" if highest >= 6 else ("4/5" if highest >= 4 else "1-3"))
    )
    out_dice = dice_results[:2] if pool <= 0 else cleaned
    return segments, out_dice, highest, critical, band


STAND_ACTION_STAT_KEYS = frozenset({"power", "speed", "precision"})
STAND_RESIST_STAT_KEYS = frozenset({"durability"})
STAND_POOL_STAT_KEYS = STAND_ACTION_STAT_KEYS | STAND_RESIST_STAT_KEYS


def resistance_stress_cost(dice, *, zero_dice=False):
    """
    Stress marked on a resistance roll (user attributes or Durability).
    Highest 6 costs 0. Two 6s: pay 0 and clear 1 (return -1).
    0-dice (2d take lower) cannot crit.
    """
    cleaned = [int(x) for x in (dice or [])]
    if not cleaned:
        return 0
    if zero_dice:
        return max(0, 6 - min(cleaned))
    highest = max(cleaned)
    sixes = sum(1 for d in cleaned if d == 6)
    if sixes >= 2:
        return -1
    return max(0, 6 - highest)

_STAND_GRADE_TO_DICE = {"F": 0, "D": 1, "C": 2, "B": 3, "A": 4, "S": 4}


def stand_grade_letter_to_dice_pool(letter):
    """SRD_DEV stand coin roll dice from grade letter (S uses 4d cap, not a fifth die)."""
    return _STAND_GRADE_TO_DICE.get(str(letter or "F").strip().upper(), 0)


def _stand_grade_from_character(character, stat_key):
    """
    Resolve Stand/coin_stats grade letter for stat_key ('power','speed',... lower case).
    """
    stat_key = str(stat_key or "").strip().lower()
    if stat_key not in STAND_POOL_STAT_KEYS:
        return None
    stand = getattr(character, "stand", None)
    if stand is not None:
        g = getattr(stand, stat_key, None)
        if g:
            return str(g).strip().upper()[:1]
    coin = getattr(character, "coin_stats", None) or {}
    if isinstance(coin, dict):
        for k, v in coin.items():
            if str(k).lower() != stat_key:
                continue
            if v:
                return str(v).strip().upper()[:1]
    legacy = getattr(character, "stand_coin_stats", None) or {}
    if isinstance(legacy, dict):
        u = stat_key.upper()
        v = legacy.get(stat_key) or legacy.get(u)
        if v:
            return str(v).strip().upper()[:1]
    return None


def stand_action_rating_from_character(character, stat_key):
    """Dot-equivalent dice count from Stand/coin_stats for Stand Coin rolls."""
    g = _stand_grade_from_character(character, stat_key)
    if not g:
        return 0
    return stand_grade_letter_to_dice_pool(g)


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


def xp_track_for_action_name(action_name):
    """
    BitD attribute track for a rolled action name (desperate-roll XP mapping).
    Returns 'insight' | 'prowess' | 'resolve' or None if not mappable.
    """
    if not (action_name or "").strip():
        return None
    action_lower = str(action_name).strip().lower()
    if action_lower in ("hunt", "study", "survey", "tinker"):
        return "insight"
    if action_lower in ("finesse", "prowl", "skirmish", "wreck"):
        return "prowess"
    if action_lower in ("bizarre", "command", "consort", "sway"):
        return "resolve"
    return None


INNATE_STAND_DICE_STATS = frozenset({"power", "speed", "precision"})


def innate_stand_stat_from_roll(action_name, stand_stat=None):
    """Return power|speed|precision if this is an innate stand-dice action, else None."""
    stat = str(stand_stat or "").strip().lower()
    if stat in INNATE_STAND_DICE_STATS:
        return stat
    an = str(action_name or "").strip().lower()
    if an.startswith("stand_"):
        tail = an[6:]
        if tail in INNATE_STAND_DICE_STATS:
            return tail
        return None
    if an in INNATE_STAND_DICE_STATS:
        return an
    return None


def award_innate_stand_dice_xp(
    character, session, roll, action_name, request_user, stand_stat=None
):
    """
    Desperate Coin Action (Power/Speed/Precision) → playbook XP via credit_xp.

    +1 normally, +2 at zero dots (grade F). Durability / Range / Development
    never grant this. Idempotent per roll. No session cap.

    Returns (xp_awarded: int, xp_track: str|None).
    """
    del request_user
    position = (roll.position or "").lower()
    roll_type = (roll.roll_type or "").upper()
    if position != "desperate" or roll_type != "ACTION":
        return 0, None
    stat = innate_stand_stat_from_roll(action_name, stand_stat)
    if not stat:
        return 0, None
    if ExperienceTracker.objects.filter(roll=roll, trigger="INNATE").exists():
        return 0, None

    rating = stand_action_rating_from_character(character, stat)
    if getattr(roll, "pool_action_rating", None) is not None:
        try:
            rating = int(roll.pool_action_rating)
        except (TypeError, ValueError):
            pass
    grant = 2 if rating <= 0 else 1
    from characters.services.advancement import credit_xp

    credit_xp(character, "playbook", grant, save=True)
    zero_note = " (0-dot)" if grant == 2 else ""
    ExperienceTracker.objects.create(
        character=character,
        session=session,
        roll=roll,
        trigger="INNATE",
        description=f"Innate: desperate stand {stat} roll{zero_note}",
        xp_gained=grant,
        award_source="AUTO",
        clock_key="playbook",
    )
    return grant, "playbook"


def award_desperate_action_xp(character, session, roll, action_name, request_user):
    """
    Desperate ACTION roll → XP on the attribute track via credit_xp.

    +1 normally, +2 at zero dots (SRD). Group-action desperate uses the same
    path. Coin Actions are not mapped here (see award_innate_stand_dice_xp).

    Returns (xp_awarded: int, xp_track: str|None).
    """
    del request_user
    position = (roll.position or "").lower()
    roll_type = (roll.roll_type or "").upper()
    if position != "desperate" or roll_type != "ACTION" or not (action_name or "").strip():
        return 0, None

    track = xp_track_for_action_name(action_name)
    if not track:
        return 0, None

    rating = action_rating_from_action_dots(
        getattr(character, "action_dots", None), action_name
    )
    if getattr(roll, "pool_action_rating", None) is not None:
        try:
            rating = int(roll.pool_action_rating)
        except (TypeError, ValueError):
            pass
    grant = 2 if rating <= 0 else 1
    from characters.services.advancement import credit_xp

    credit_xp(character, track, grant, save=True)
    zero_note = " (0-dot)" if grant == 2 else ""
    ExperienceTracker.objects.create(
        character=character,
        session=session,
        roll=roll,
        trigger="DESPERATE_ROLL",
        description=f"Desperate roll: {action_name}{zero_note}",
        xp_gained=grant,
        award_source="AUTO",
        clock_key=track,
    )
    return grant, track


def normalized_trauma_pks(raw):
    """Coerce Character.trauma JSON list entries to positive int PKs."""
    if raw is None:
        return set()
    if isinstance(raw, (list, tuple)):
        items = raw
    elif isinstance(raw, dict):
        return set()
    else:
        return set()
    out = set()
    for item in items:
        if isinstance(item, bool):
            continue
        if isinstance(item, int) and item > 0:
            out.add(item)
            continue
        if isinstance(item, float) and item > 0 and item == int(item):
            out.add(int(item))
            continue
        if isinstance(item, str) and item.strip().isdigit():
            n = int(item.strip())
            if n > 0:
                out.add(n)
    return out


def award_struggle_for_new_traumas(character, session, gained_pks):
    """
    Grant STRUGGLE XP to the free pool when new trauma IDs appear on save,
    same session bucket as vice-based STRUGGLE and session settlement caps.
    """
    if not gained_pks or session is None or character is None:
        return 0
    n = len(gained_pks)
    desc = (
        "Auto (character save during active session): new trauma marked — "
        f"counts toward struggle / trauma XP trigger (+{n})."
    )[:500]
    return grant_encoded_trigger_xp(
        character,
        session,
        trigger="STRUGGLE",
        clock_key="pool",
        clock_max=0,
        want=n,
        description=desc,
        roll=None,
    )


def heritage_bonus_labels(raw):
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    if isinstance(raw, str) and raw.strip():
        return [raw.strip()]
    return []


def award_heritage_expression_xp(character, session, roll, heritage_bonuses_raw):
    """
    BELIEFS XP to the free pool when a roll applies optional heritage bonuses.
    Separate session bucket from playbook STRUGGLE/PLAYBOOK_SPECIFIC.
    """
    labels = heritage_bonus_labels(heritage_bonuses_raw)
    if not labels or session is None or roll is None or character is None:
        return 0
    desc = (
        "Auto (heritage benefit on roll): "
        + ", ".join(labels)
    )[:500]
    return grant_encoded_trigger_xp(
        character,
        session,
        trigger="BELIEFS",
        clock_key="pool",
        clock_max=0,
        want=1,
        description=desc,
        roll=roll,
    )


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
    consequence, 1–3 = failure (`docs/1-(800)-BIZARRE SRD.md`: read highest; 4–5 mixed; 1–3 fail).
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


def max_stress_slots_for_character(character):
    """
    Stress track length on the sheet (SRD_DEV: 9 for PCs; Stand Durability affects armor, not this count).

    Character.stress in the API is the **filled / marked** count on that track
    (same as the sheet's stressFilled), not "remaining budget."
    """
    return 9
