"""
Apply once-per-session encoded XP when a session is deactivated or completed.

Desperate action XP is already awarded per roll (DESPERATE_ROLL). This pass only adds capped playbook-track XP for signals we can read from stored rolls:
  - STANDOUT: roll description includes [Abilities: …] (playbook / stand ability used)
  - STRUGGLE: vice (CLEAR_STRESS) with overindulgence note, or vice clear failed (FAILURE/BOTCH)

Immediate awards (outside this settle sweep): BELIEFS XP on the heritage clock when rolls
carry ``[Heritage: …]`` (`roll_helpers.award_heritage_expression_xp`); playbook STRUGGLE when
new trauma IDs are saved while the campaign has an active session (`award_struggle_for_new_traumas`).

Entanglements, brawls, and other table fiction are intentionally NOT inferred here;
the GM should add those via manual XP.

SRD-style per-trigger session cap defaults to 2 XP on the playbook clock (same
shape as frontend sumTrackerXpByTriggers caps).
"""

from __future__ import annotations

import logging
from typing import Any

from django.db import transaction
from django.db.models import Sum

from ..models import Character, ExperienceTracker, Roll, Session

logger = logging.getLogger(__name__)

_SESSION_TRIGGER_CAP = 2


def trigger_xp_session_sum(character: Character, session: Session, triggers: list[str]) -> int:
    total = (
        ExperienceTracker.objects.filter(
            character=character, session=session, trigger__in=triggers
        ).aggregate(s=Sum("xp_gained"))["s"]
        or 0
    )
    return int(total)


def grant_encoded_trigger_xp(
    character: Character,
    session: Session,
    *,
    trigger: str,
    clock_key: str,
    clock_max: int,
    want: int,
    description: str,
    roll: Roll | None = None,
    session_trigger_cap: int | None = None,
) -> int:
    """Apply encoded XP toward ``xp_clocks[clock_key]`` for BitD-style session caps."""
    if want <= 0 or session is None:
        return 0
    cap = (
        session_trigger_cap
        if session_trigger_cap is not None
        else _SESSION_TRIGGER_CAP
    )
    used = trigger_xp_session_sum(character, session, [trigger])
    cap_left = max(0, cap - used)
    grant = min(int(want), cap_left)
    if grant <= 0:
        return 0
    clocks = dict(character.xp_clocks or {})
    cur = int(clocks.get(clock_key, 0) or 0)
    new = min(int(clock_max), cur + grant)
    actual = new - cur
    if actual <= 0:
        return 0
    clocks[clock_key] = new
    character.xp_clocks = clocks
    character.save(update_fields=["xp_clocks"])
    ExperienceTracker.objects.create(
        character=character,
        session=session,
        roll=roll,
        trigger=trigger,
        description=(description or "")[:500],
        xp_gained=actual,
    )
    return actual


def _grant_playbook_track(
    character: Character,
    session: Session,
    trigger: str,
    want: int,
    description: str,
    roll: Roll | None = None,
) -> int:
    """Add up to ``want`` XP on playbook clock (max 10) for STRUGGLE / STANDOUT style triggers."""
    return grant_encoded_trigger_xp(
        character,
        session,
        trigger=trigger,
        clock_key="playbook",
        clock_max=10,
        want=want,
        description=description,
        roll=roll,
        session_trigger_cap=_SESSION_TRIGGER_CAP,
    )


def _roll_has_playbook_abilities_note(roll: Roll) -> bool:
    d = (roll.description or "").lower()
    return "[abilities:" in d


def _vice_struggle_signals(roll: Roll) -> int:
    if (roll.roll_type or "").upper() != "CLEAR_STRESS":
        return 0
    if "vice" not in (roll.action_name or "").lower():
        return 0
    desc = (roll.description or "").lower()
    if "overindulgence" in desc:
        return 1
    if (roll.outcome or "") in ("FAILURE", "BOTCH"):
        return 1
    return 0


def settle_encoded_session_xp(session: Session, acting_user: Any) -> dict:
    """
    Idempotent encoded XP for one session. Safe to call multiple times.

    acting_user is used only for audit logging; permissions are enforced by callers.
    """
    out: dict[str, Any] = {"session_id": session.id, "applied": []}
    with transaction.atomic():
        locked = Session.objects.select_for_update().get(pk=session.pk)
        if locked.auto_encoded_xp_settled:
            out["skipped"] = True
            out["reason"] = "already_settled"
            return out
        rolls = list(
            Roll.objects.filter(session=session).select_related("character")
        )
        char_ids = {r.character_id for r in rolls if r.character_id}
        char_ids |= set(
            locked.characters_involved.values_list("id", flat=True)
        )
        if not char_ids:
            Session.objects.filter(pk=session.pk).update(
                auto_encoded_xp_settled=True
            )
            out["message"] = "no_characters"
            return out
        for cid in sorted(char_ids):
            try:
                char = Character.objects.select_for_update().get(pk=cid)
            except Character.DoesNotExist:
                continue
            if char.campaign_id != locked.campaign_id:
                continue
            crolls = [r for r in rolls if r.character_id == cid]
            struggle_events = sum(_vice_struggle_signals(r) for r in crolls)
            struggle_want = min(_SESSION_TRIGGER_CAP, struggle_events)
            standout_events = sum(1 for r in crolls if _roll_has_playbook_abilities_note(r))
            standout_want = min(_SESSION_TRIGGER_CAP, standout_events)
            if struggle_want:
                n = _grant_playbook_track(
                    char,
                    locked,
                    "STRUGGLE",
                    struggle_want,
                    "Auto (session settle): vice stress roll showed overindulgence "
                    "and/or failed to clear stress (encoded from roll log).",
                    None,
                )
                if n:
                    out["applied"].append(
                        {"character": cid, "trigger": "STRUGGLE", "xp": n}
                    )
            if standout_want:
                n = _grant_playbook_track(
                    char,
                    locked,
                    "STANDOUT",
                    standout_want,
                    "Auto (session settle): playbook / stand ability noted on a roll "
                    "([Abilities: …] in roll description).",
                    None,
                )
                if n:
                    out["applied"].append(
                        {"character": cid, "trigger": "STANDOUT", "xp": n}
                    )
        Session.objects.filter(pk=session.pk).update(auto_encoded_xp_settled=True)
    logger.info(
        "session_xp_settlement session=%s user=%s applied=%s",
        session.id,
        getattr(acting_user, "id", None),
        out.get("applied"),
    )
    return out
