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
def credit_xp(character, track: str, amount: int, *, save: bool = True) -> dict:
    """
    Add marks to an XP track. While filled, subtract cap, mint PendingAdvance,
    leftover stays. Loops so overflow stacks open pendings.

    Does not create ExperienceTracker rows — callers own award ledger.
    Caller should set skip_sheet_patch_guard when persisting via serializer.
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

    return {
        "track": key,
        "marks": marks,
        "cap": cap,
        "pending_ids": minted,
        "pendings_minted": len(minted),
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
