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


def outcome_from_dice_results(results):
    """Highest die → Blades-style outcome bucket."""
    if not results:
        return 'FAILURE'
    max_result = max(results)
    if max_result >= 6:
        return 'CRITICAL_SUCCESS'
    if max_result >= 4:
        return 'FULL_SUCCESS'
    if max_result >= 1:
        return 'PARTIAL_SUCCESS'
    return 'FAILURE'
