"""Fill-clear XP credit: mint PendingAdvance whenever a track fills."""

from __future__ import annotations

from django.db import transaction

from characters.models import PendingAdvance

XP_TRACKS = ("insight", "prowess", "resolve", "heritage", "playbook")
TRACK_CAPS = {
    "insight": 5,
    "prowess": 5,
    "resolve": 5,
    "heritage": 5,
    "playbook": 10,
}


class AdvancementError(Exception):
    """User-facing advancement failure."""

    def __init__(self, message, code="invalid"):
        super().__init__(message)
        self.message = message
        self.code = code


def track_cap(track: str) -> int:
    key = str(track or "").strip().lower()
    if key not in TRACK_CAPS:
        raise AdvancementError(f"Invalid XP track: {track}")
    return TRACK_CAPS[key]


@transaction.atomic
def credit_xp(
    character, track: str, amount: int, *, save: bool = True, walk_plan: bool = True
) -> dict:
    """
    Add marks to an XP track. While filled, subtract cap, mint PendingAdvance,
    leftover stays. Loops so overflow stacks open pendings.

    Does not create ExperienceTracker rows — callers own award ledger.
    Caller should set skip_sheet_patch_guard when persisting via serializer.

    ``walk_plan`` (default True): after minting, drain open pendings via the
    advancement plan queue. Pass False when the caller will immediately redeem
    a pending manually (direct sheet click) so a queued plan item cannot steal
    that fill.
    """
    if character is None or not getattr(character, "pk", None):
        raise AdvancementError("Character is required.")
    key = str(track or "").strip().lower()
    if key not in TRACK_CAPS:
        raise AdvancementError(f"Invalid XP track: {track}")
    try:
        amt = int(amount)
    except (TypeError, ValueError) as exc:
        raise AdvancementError("amount must be an integer") from exc
    if amt < 1:
        raise AdvancementError("amount must be at least 1")

    cap = TRACK_CAPS[key]
    clocks = dict(character.xp_clocks or {})
    marks = int(clocks.get(key, 0) or 0) + amt
    minted = []

    while marks >= cap:
        marks -= cap
        pending = PendingAdvance.objects.create(
            character=character,
            track=key,
            status=PendingAdvance.STATUS_OPEN,
        )
        minted.append(pending.id)

    clocks[key] = marks
    character.xp_clocks = clocks
    if save:
        character.save(update_fields=["xp_clocks"])

    walk_result = None
    if minted and walk_plan:
        # Plan B: drain open pendings via first-legal queue walk.
        # Never let walk failure roll back the mint+clear.
        try:
            from characters.services.plan_queue import drain_and_walk_plan

            walk_result = drain_and_walk_plan(character, key)
        except Exception as exc:  # noqa: BLE001 — mint must stick
            import logging

            logging.getLogger(__name__).exception(
                "plan walk failed after credit_xp (character=%s track=%s): %s",
                getattr(character, "pk", None),
                key,
                exc,
            )
            walk_result = {"applied": [], "blocked": [], "error": str(exc)}

    return {
        "track": key,
        "marks": marks,
        "cap": cap,
        "pending_ids": minted,
        "pendings_minted": len(minted),
        "plan_walk": walk_result,
    }


def open_pending_count(character, track: str | None = None) -> int:
    qs = PendingAdvance.objects.filter(
        character=character,
        status=PendingAdvance.STATUS_OPEN,
    )
    if track is not None:
        qs = qs.filter(track=str(track).strip().lower())
    return qs.count()


def oldest_open_pending(character, track: str):
    key = str(track or "").strip().lower()
    return (
        PendingAdvance.objects.filter(
            character=character,
            track=key,
            status=PendingAdvance.STATUS_OPEN,
        )
        .order_by("created_at", "id")
        .first()
    )


@transaction.atomic
def cancel_pending_advance(
    character, track: str, *, pending_id=None, save: bool = True
) -> dict:
    """
    Forfeit one open pending: refund (cap - 1) to unallocated_xp and +1 mark
    on the track without credit_xp (avoids re-minting).

    Playbook: +9 unallocated, +1 playbook. Attribute/heritage (cap 5): +4 / +1.
    """
    if character is None or not getattr(character, "pk", None):
        raise AdvancementError("Character is required.")
    key = str(track or "").strip().lower()
    if key not in TRACK_CAPS:
        raise AdvancementError(f"Invalid XP track: {track}")

    qs = PendingAdvance.objects.filter(
        character=character,
        track=key,
        status=PendingAdvance.STATUS_OPEN,
    ).order_by("created_at", "id")
    if pending_id is not None:
        try:
            pid = int(pending_id)
        except (TypeError, ValueError) as exc:
            raise AdvancementError("pending_id must be an integer") from exc
        pending = qs.filter(pk=pid).first()
        if pending is None:
            raise AdvancementError(
                "No open pending advance with that id on this track.",
                code="not_found",
            )
    else:
        pending = qs.first()
        if pending is None:
            raise AdvancementError(
                f"No open pending advance on {key}.",
                code="not_found",
            )

    cap = TRACK_CAPS[key]
    pool_refund = cap - 1
    clocks = dict(character.xp_clocks or {})
    marks = int(clocks.get(key, 0) or 0) + 1
    clocks[key] = marks
    character.xp_clocks = clocks
    pool = int(getattr(character, "unallocated_xp", 0) or 0) + pool_refund
    character.unallocated_xp = pool
    pending_pk = pending.pk
    pending.delete()

    if save:
        character.save(update_fields=["xp_clocks", "unallocated_xp"])

    return {
        "track": key,
        "cancelled_pending_id": pending_pk,
        "marks": marks,
        "cap": cap,
        "unallocated_xp": pool,
        "pool_refund": pool_refund,
        "track_refund": 1,
        "open_pending_count": open_pending_count(character, key),
    }
