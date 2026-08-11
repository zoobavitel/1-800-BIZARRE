"""
Apply once-per-session encoded XP when a session is deactivated or completed.

Desperate action XP is already awarded per roll (DESPERATE_ROLL). This pass adds:
  - Capped playbook-track XP from stored rolls (STRUGGLE only — vice signals), and
  - Stand Development session XP into each PC's ``Character.unallocated_xp`` pool
    (players allocate pool XP to tracks on the character sheet).

Encoded signals from stored rolls:
  - STRUGGLE: vice (CLEAR_STRESS) with overindulgence note, or vice clear failed (FAILURE/BOTCH)

Playbook-specific session XP is toggled on the sheet (PLAYBOOK_SPECIFIC), not inferred from rolls.

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
from django.db.models import F, Sum

from ..models import Character, ExperienceTracker, Roll, Session

logger = logging.getLogger(__name__)

_SESSION_TRIGGER_CAP = 2

# Stand Development grade → session XP banked to `Character.unallocated_xp` at settle
# (matches `Character.development_xp_bonus` / frontend DEV_SESSION_XP for S).
_DEV_SESSION_XP_BY_GRADE = {"F": 0, "D": 1, "C": 2, "B": 3, "A": 4, "S": 5}


def development_session_xp_to_pool_amount(character: Character) -> int:
    """SRD_DEV: end-of-session Stand Development XP → unallocated pool (not a track)."""
    stand = getattr(character, "stand", None)
    if stand is None:
        return 0
    g = (getattr(stand, "development", None) or "F")[:1].upper()
    if g not in _DEV_SESSION_XP_BY_GRADE:
        g = "F"
    return int(_DEV_SESSION_XP_BY_GRADE[g])


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
    awarded_by: Any = None,
    award_source: str = "AUTO",
) -> int:
    """Apply encoded XP toward ``xp_clocks[clock_key]`` for BitD-style session caps.

    ``awarded_by`` + ``award_source`` are stored on the tracker entry so the
    XP records UI can attribute each row to a player / GM / automatic source;
    ``clock_key`` is also persisted so that deleting the entry can roll back
    the exact track it advanced.
    """
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
        awarded_by=awarded_by,
        award_source=award_source,
        clock_key=clock_key,
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
    """Add up to ``want`` XP on playbook clock (max 10) for STRUGGLE / playbook toggles."""
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


def mark_encoded_session_xp_settled_without_xp(
    session: Session, acting_user: Any = None
) -> dict:
    """
    Mark the one-time encoded playbook XP pass as done without granting XP.

    Used when the GM ends the live session but opts out of automatic encoded
    STRUGGLE settlement (playbook-specific XP remains manual toggles only).
    """
    out: dict[str, Any] = {"session_id": session.id, "encoded_xp_skipped": True}
    with transaction.atomic():
        locked = Session.objects.select_for_update().get(pk=session.pk)
        if locked.auto_encoded_xp_settled:
            out["skipped"] = True
            out["reason"] = "already_settled"
            return out
        Session.objects.filter(pk=session.pk).update(auto_encoded_xp_settled=True)
    logger.info(
        "session_xp_settlement skipped (no XP grant) session=%s user=%s",
        session.id,
        getattr(acting_user, "id", None),
    )
    return out


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
        # Mid-session scorecard awards (BELIEFS / PLAYBOOK_SPECIFIC / etc.) even when
        # characters_involved was never filled — still grant Dev→pool at settle.
        char_ids |= set(
            ExperienceTracker.objects.filter(session=locked).values_list(
                "character_id", flat=True
            )
        )
        if not char_ids:
            Session.objects.filter(pk=session.pk).update(
                auto_encoded_xp_settled=True
            )
            out["message"] = "no_characters"
            return out
        for cid in sorted(char_ids):
            try:
                # Postgres: FOR UPDATE + select_related("stand") uses a LEFT OUTER JOIN
                # (nullable reverse OneToOne) and raises NotSupportedError. Lock only
                # characters_character via of=("self",).
                char = (
                    Character.objects.select_for_update(of=("self",))
                    .select_related("stand")
                    .get(pk=cid)
                )
            except Character.DoesNotExist:
                continue
            if char.campaign_id != locked.campaign_id:
                continue
            crolls = [r for r in rolls if r.character_id == cid]
            struggle_events = sum(_vice_struggle_signals(r) for r in crolls)
            struggle_want = min(_SESSION_TRIGGER_CAP, struggle_events)
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
            dev_pool = development_session_xp_to_pool_amount(char)
            if dev_pool > 0:
                Character.objects.filter(pk=cid).update(
                    unallocated_xp=F("unallocated_xp") + dev_pool
                )
                ExperienceTracker.objects.create(
                    character_id=cid,
                    session=locked,
                    roll=None,
                    trigger="MANUAL",
                    description=(
                        "Session end (pool): Stand Development session XP "
                        f"(+{dev_pool}; allocate from pool on character sheet)."
                    )[:500],
                    xp_gained=dev_pool,
                    award_source="AUTO",
                    clock_key="",
                )
                out["applied"].append(
                    {"character": cid, "trigger": "DEVELOPMENT_POOL", "xp": dev_pool}
                )
        Session.objects.filter(pk=session.pk).update(auto_encoded_xp_settled=True)
    logger.info(
        "session_xp_settlement session=%s user=%s applied=%s",
        session.id,
        getattr(acting_user, "id", None),
        out.get("applied"),
    )
    return out
