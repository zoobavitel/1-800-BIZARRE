"""Revert individual CharacterHistory rows on the character sheet."""

from __future__ import annotations

import json
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from ..history_context import bind_character_history_editor, suppress_character_history_logging
from ..models import Character, CharacterHistory, CharacterXPAllocation, ExperienceTracker
from .xp_allocation import STAND_STAT_FIELDS, redo_allocation, undo_allocation

ALLOCATION_HISTORY_FIELDS = frozenset(
    {
        "xp_clocks",
        "total_xp_spent",
        "heritage_points_gained",
        "stand_coin_points_gained",
        "action_dice_gained",
        "action_dots",
        "coin_stats",
        "advancement_ability_grants",
        "unallocated_xp",
    }
)

TRACKER_MIRROR_FIELDS = frozenset({"xp_clocks", "unallocated_xp"})


class CharacterHistoryUndoError(Exception):
    def __init__(self, message, code="invalid"):
        super().__init__(message)
        self.message = message
        self.code = code


def _user_may_edit_character(user, character: Character) -> bool:
    if user.is_staff:
        return True
    if character.user_id == user.id:
        return True
    if character.campaign_id and character.campaign.gm_id == user.id:
        return True
    return False


def _user_is_gm_for_character(user, character: Character) -> bool:
    return bool(
        user.is_staff
        or (
            character.campaign_id
            and character.campaign.gm_id == user.id
        )
    )


def experience_tracker_undoable_from_sheet(entry: ExperienceTracker, user) -> tuple[bool, str | None]:
    """Whether a player may delete this tracker row from the character sheet."""
    character = entry.character
    if not _user_may_edit_character(user, character):
        return False, "You cannot edit this character."
    if _user_is_gm_for_character(user, character):
        return True, None
    if character.user_id != user.id:
        return False, "Not your character."
    source = str(entry.award_source or "AUTO").upper()
    if source in ("GM", "AUTO"):
        return (
            False,
            "GM and automatic session XP can only be removed from the campaign scorecard.",
        )
    return True, None


def _find_linked_allocation(
    character: Character, entry: CharacterHistory
) -> CharacterXPAllocation | None:
    changed = entry.changed_fields or {}
    if not changed.keys() & ALLOCATION_HISTORY_FIELDS:
        return None
    window_start = entry.timestamp - timedelta(seconds=3)
    window_end = entry.timestamp + timedelta(seconds=3)
    return (
        CharacterXPAllocation.objects.filter(
            character=character,
            undone_at__isnull=True,
            created_at__gte=window_start,
            created_at__lte=window_end,
        )
        .order_by("-created_at", "-id")
        .first()
    )


def _find_linked_tracker_entry(
    character: Character, entry: CharacterHistory
) -> ExperienceTracker | None:
    changed = entry.changed_fields or {}
    if not changed.keys() <= TRACKER_MIRROR_FIELDS:
        return None
    window_start = entry.timestamp - timedelta(seconds=3)
    window_end = entry.timestamp + timedelta(seconds=3)
    return (
        ExperienceTracker.objects.filter(
            character=character,
            session_date__gte=window_start,
            session_date__lte=window_end,
        )
        .order_by("-session_date", "-id")
        .first()
    )


def can_undo_character_history(entry: CharacterHistory, user) -> tuple[bool, str | None]:
    if entry.reverted_at:
        return False, "Already undone."
    character = entry.character
    if not _user_may_edit_character(user, character):
        return False, "You cannot edit this character."

    linked_tracker = _find_linked_tracker_entry(character, entry)
    if linked_tracker is not None:
        return (
            False,
            "Undo the matching XP record row instead (this entry mirrors session XP).",
        )

    linked_alloc = _find_linked_allocation(character, entry)
    if linked_alloc is not None:
        latest = (
            CharacterXPAllocation.objects.filter(
                character=character, undone_at__isnull=True
            )
            .order_by("-created_at", "-id")
            .first()
        )
        if not latest or latest.id != linked_alloc.id:
            return False, "Undo newer XP spends first."
        return True, None

    return True, None


def _deserialize_field_value(character: Character, field_name: str, stored):
    if stored is None or stored == "":
        field = character._meta.get_field(field_name)
        if getattr(field, "null", False):
            return None
        if field.get_internal_type() == "JSONField":
            return field.get_default() if field.has_default() else {}
        return field.get_default() if field.has_default() else None

    field = character._meta.get_field(field_name)
    internal = field.get_internal_type()
    if internal == "JSONField":
        if isinstance(stored, (dict, list)):
            return stored
        return json.loads(stored)
    if internal in ("ForeignKey", "OneToOneField"):
        return int(stored) if str(stored).isdigit() else None
    if internal == "BooleanField":
        return str(stored).lower() in ("true", "1", "yes")
    if internal in ("IntegerField", "PositiveIntegerField", "BigIntegerField"):
        return int(stored)
    if internal == "FloatField":
        return float(stored)
    return stored


def _set_stand_grades_from_coin_stats(character: Character, coin_stats: dict) -> None:
    grades = dict(coin_stats or {})
    character.coin_stats = grades
    try:
        if hasattr(character, "stand") and character.stand:
            stand = character.stand
            for field in STAND_STAT_FIELDS:
                val = grades.get(field)
                if val is None:
                    val = grades.get(field.upper())
                if val is not None:
                    setattr(stand, field, str(val).upper()[:1])
            stand.save()
    except Exception:
        pass


def _apply_field_value(character: Character, field_name: str, stored_value) -> None:
    if field_name == "coin_stats":
        parsed = _deserialize_field_value(character, field_name, stored_value)
        _set_stand_grades_from_coin_stats(character, parsed)
        return
    parsed = _deserialize_field_value(character, field_name, stored_value)
    setattr(character, field_name, parsed)


def _apply_field_revert(character: Character, field_name: str, old_value) -> None:
    _apply_field_value(character, field_name, old_value)


@transaction.atomic
def redo_character_history_entry(
    entry: CharacterHistory, *, user, require_editor_id=None
) -> CharacterHistory:
    if not entry.reverted_at:
        raise CharacterHistoryUndoError("This history entry is not reverted.")
    character = entry.character
    if not _user_may_edit_character(user, character):
        raise CharacterHistoryUndoError("You cannot edit this character.")

    reverted_qs = CharacterHistory.objects.filter(
        character=character, reverted_at__isnull=False
    )
    if require_editor_id is not None:
        reverted_qs = reverted_qs.filter(editor_id=require_editor_id)
    latest_reverted = reverted_qs.order_by("-reverted_at", "-id").first()
    if not latest_reverted or latest_reverted.id != entry.id:
        raise CharacterHistoryUndoError(
            "Redo the most recently reverted change first."
        )

    linked_alloc = _find_linked_undone_allocation(character, entry)
    editor_token = bind_character_history_editor(user)
    try:
        with suppress_character_history_logging():
            if linked_alloc is not None:
                redo_allocation(character, linked_alloc, user=user)
            else:
                changed = entry.changed_fields or {}
                for field_name, chunk in changed.items():
                    if not isinstance(chunk, dict):
                        continue
                    new_value = chunk.get("new")
                    _apply_field_value(character, field_name, new_value)
                character.save()
    finally:
        from ..history_context import reset_character_history_editor

        reset_character_history_editor(editor_token)

    entry.reverted_at = None
    entry.reverted_by = None
    entry.save(update_fields=["reverted_at", "reverted_by"])
    character.refresh_from_db()
    return entry


@transaction.atomic
def undo_character_history_entry(entry: CharacterHistory, *, user) -> CharacterHistory:
    if entry.reverted_at:
        raise CharacterHistoryUndoError("This history entry was already undone.")
    character = entry.character
    allowed, reason = can_undo_character_history(entry, user)
    if not allowed:
        raise CharacterHistoryUndoError(reason or "Cannot undo this entry.")

    linked_alloc = _find_linked_allocation(character, entry)
    editor_token = bind_character_history_editor(user)
    try:
        with suppress_character_history_logging():
            if linked_alloc is not None:
                undo_allocation(character, linked_alloc, user=user)
            else:
                changed = entry.changed_fields or {}
                for field_name, chunk in changed.items():
                    if not isinstance(chunk, dict):
                        continue
                    old_value = chunk.get("old")
                    _apply_field_revert(character, field_name, old_value)
                character.save()
    finally:
        from ..history_context import reset_character_history_editor

        reset_character_history_editor(editor_token)

    entry.reverted_at = timezone.now()
    entry.reverted_by = user
    entry.save(update_fields=["reverted_at", "reverted_by"])
    character.refresh_from_db()
    return entry


def _gm_may_undo_pc(gm_user, character: Character) -> bool:
    if not _user_is_gm_for_character(gm_user, character):
        return False
    if character.user_id == gm_user.id:
        return False
    return True


def _rollback_clock(character: Character, clock_key: str, amount: int) -> None:
    clocks = dict(character.xp_clocks or {})
    cur = int(clocks.get(clock_key, 0) or 0)
    clocks[clock_key] = max(0, cur - int(amount))
    character.xp_clocks = clocks
    character.save(update_fields=["xp_clocks"])


def _rollback_pool(character: Character, amount: int) -> None:
    cur = int(getattr(character, "unallocated_xp", 0) or 0)
    character.unallocated_xp = max(0, cur - int(amount))
    character.save(update_fields=["unallocated_xp"])


def _find_linked_undone_allocation(
    character: Character, entry: CharacterHistory
) -> CharacterXPAllocation | None:
    changed = entry.changed_fields or {}
    if not changed.keys() & ALLOCATION_HISTORY_FIELDS:
        return None
    window_start = entry.timestamp - timedelta(seconds=3)
    window_end = entry.timestamp + timedelta(seconds=3)
    return (
        CharacterXPAllocation.objects.filter(
            character=character,
            undone_at__isnull=False,
            created_at__gte=window_start,
            created_at__lte=window_end,
        )
        .order_by("-undone_at", "-id")
        .first()
    )


def _find_mirror_history_for_tracker(
    character: Character, tracker: ExperienceTracker, *, gm_id: int
) -> CharacterHistory | None:
    window_start = tracker.session_date - timedelta(seconds=3)
    window_end = tracker.session_date + timedelta(seconds=3)
    return (
        CharacterHistory.objects.filter(
            character=character,
            editor_id=gm_id,
            reverted_at__isnull=True,
            timestamp__gte=window_start,
            timestamp__lte=window_end,
        )
        .order_by("-timestamp", "-id")
        .first()
    )


def _summarize_history_fields(entry: CharacterHistory, *, prefix: str) -> str:
    changed = entry.changed_fields or {}
    keys = list(changed.keys())[:3]
    labels = ", ".join(k.replace("_", " ") for k in keys) or "fields"
    extra = f" (+{len(changed) - 3} more)" if len(changed) > 3 else ""
    return f"{prefix} ({labels}{extra})"


def _summarize_gm_undo(kind: str, obj) -> str:
    if kind == "tracker":
        trig = (
            obj.get_trigger_display()
            if hasattr(obj, "get_trigger_display")
            else obj.trigger
        )
        return f"GM XP +{obj.xp_gained} ({trig})"
    if kind == "history":
        return _summarize_history_fields(obj, prefix="GM sheet edit")
    return "GM change"


def _is_pure_sheet_field_edit(entry: CharacterHistory) -> bool:
    """Field edits only — not XP allocation spends or ExperienceTracker mirrors."""
    character = entry.character
    if _find_linked_tracker_entry(character, entry) is not None:
        return False
    if _find_linked_allocation(character, entry) is not None:
        return False
    if _find_linked_undone_allocation(character, entry) is not None:
        return False
    return True


def latest_sheet_undo_target(character: Character, user):
    """Newest undoable pure sheet-field CharacterHistory row, or None."""
    if not _user_may_edit_character(user, character):
        return None
    qs = (
        CharacterHistory.objects.filter(
            character=character,
            reverted_at__isnull=True,
        )
        .order_by("-timestamp", "-id")[:80]
    )
    for entry in qs:
        if not _is_pure_sheet_field_edit(entry):
            continue
        allowed, _reason = can_undo_character_history(entry, user)
        if allowed:
            return entry
    return None


def sheet_undo_status(character: Character, user) -> dict:
    entry = latest_sheet_undo_target(character, user)
    if not entry:
        return {"available": False, "summary": None, "kind": None, "target_id": None}
    return {
        "available": True,
        "summary": _summarize_history_fields(entry, prefix="Sheet edit"),
        "kind": "history",
        "target_id": entry.id,
    }


def latest_sheet_redo_target(character: Character, user):
    """Most recently reverted pure sheet-field history row, or None.

    Redo is LIFO across all history undos: only available when the newest
    reverted row is a pure sheet field edit.
    """
    if not _user_may_edit_character(user, character):
        return None
    latest_reverted = (
        CharacterHistory.objects.filter(
            character=character,
            reverted_at__isnull=False,
        )
        .order_by("-reverted_at", "-id")
        .first()
    )
    if not latest_reverted or not _is_pure_sheet_field_edit(latest_reverted):
        return None
    return latest_reverted


def sheet_redo_status(character: Character, user) -> dict:
    entry = latest_sheet_redo_target(character, user)
    if not entry:
        return {"available": False, "summary": None, "kind": None, "target_id": None}
    return {
        "available": True,
        "summary": _summarize_history_fields(entry, prefix="Sheet edit"),
        "kind": "history",
        "target_id": entry.id,
    }


@transaction.atomic
def undo_latest_sheet_edit(character: Character, *, user) -> dict:
    if not _user_may_edit_character(user, character):
        raise CharacterHistoryUndoError("You cannot edit this character.")
    entry = latest_sheet_undo_target(character, user)
    if not entry:
        raise CharacterHistoryUndoError("No sheet edit to undo on this character.")
    undo_character_history_entry(entry, user=user)
    character.refresh_from_db()
    return {
        "kind": "history",
        "target_id": entry.id,
        "status": sheet_undo_status(character, user),
        "redo_status": sheet_redo_status(character, user),
    }


@transaction.atomic
def redo_latest_sheet_edit(character: Character, *, user) -> dict:
    if not _user_may_edit_character(user, character):
        raise CharacterHistoryUndoError("You cannot edit this character.")
    entry = latest_sheet_redo_target(character, user)
    if not entry:
        raise CharacterHistoryUndoError("No sheet edit to redo on this character.")
    redo_character_history_entry(entry, user=user)
    character.refresh_from_db()
    return {
        "kind": "history",
        "target_id": entry.id,
        "status": sheet_redo_status(character, user),
        "undo_status": sheet_undo_status(character, user),
    }


def latest_gm_undo_target(character: Character, gm_user):
    """Return (kind, obj) for newest undoable GM XP award only, or (None, None).

    Sheet field edits use ``undo_latest_sheet_edit`` instead.
    """
    if not _gm_may_undo_pc(gm_user, character):
        return None, None

    tracker = (
        ExperienceTracker.objects.filter(
            character=character,
            awarded_by_id=gm_user.id,
            award_source="GM",
            revoked_at__isnull=True,
        )
        .order_by("-session_date", "-id")
        .first()
    )
    if not tracker:
        return None, None
    return "tracker", tracker


def gm_undo_status(character: Character, gm_user) -> dict:
    kind, obj = latest_gm_undo_target(character, gm_user)
    if not obj:
        return {"available": False, "summary": None, "kind": None}
    return {
        "available": True,
        "summary": _summarize_gm_undo(kind, obj),
        "kind": kind,
        "target_id": obj.id,
    }


@transaction.atomic
def undo_gm_tracker_entry(tracker: ExperienceTracker, *, gm_user) -> None:
    character = tracker.character
    if tracker.awarded_by_id != gm_user.id or tracker.award_source != "GM":
        raise CharacterHistoryUndoError("Not a GM award you made.")
    mirror = _find_mirror_history_for_tracker(
        character, tracker, gm_id=gm_user.id
    )
    amount = int(tracker.xp_gained or 0)
    clock_key = (tracker.clock_key or "").strip()
    desc = tracker.description or ""
    tracker.revoked_at = timezone.now()
    tracker.revoked_by = gm_user
    tracker.save(update_fields=["revoked_at", "revoked_by"])
    locked_char = Character.objects.select_for_update().get(pk=character.pk)
    if amount > 0 and clock_key:
        _rollback_clock(locked_char, clock_key, amount)
    elif amount > 0 and "Session end (pool)" in desc:
        _rollback_pool(locked_char, amount)

    if mirror:
        mirror.reverted_at = timezone.now()
        mirror.reverted_by = gm_user
        mirror.save(update_fields=["reverted_at", "reverted_by"])


def _grant_clock(character: Character, clock_key: str, amount: int) -> None:
    from .xp_allocation import TRACK_CAPS

    cap = TRACK_CAPS.get(clock_key, 10)
    clocks = dict(character.xp_clocks or {})
    cur = int(clocks.get(clock_key, 0) or 0)
    clocks[clock_key] = min(cap, cur + int(amount))
    character.xp_clocks = clocks
    character.save(update_fields=["xp_clocks"])


def _find_mirror_history_for_revoked_tracker(
    character: Character, tracker: ExperienceTracker, *, gm_id: int
) -> CharacterHistory | None:
    if not tracker.revoked_at:
        return None
    window_start = tracker.session_date - timedelta(seconds=3)
    window_end = tracker.revoked_at + timedelta(seconds=3)
    return (
        CharacterHistory.objects.filter(
            character=character,
            editor_id=gm_id,
            reverted_at__isnull=False,
            timestamp__gte=window_start,
            timestamp__lte=window_end,
        )
        .order_by("-timestamp", "-id")
        .first()
    )


@transaction.atomic
def redo_gm_tracker_entry(tracker: ExperienceTracker, *, gm_user) -> None:
    character = tracker.character
    if tracker.awarded_by_id != gm_user.id or tracker.award_source != "GM":
        raise CharacterHistoryUndoError("Not a GM award you made.")
    if not tracker.revoked_at:
        raise CharacterHistoryUndoError("This GM XP award is not revoked.")

    amount = int(tracker.xp_gained or 0)
    clock_key = (tracker.clock_key or "").strip()
    desc = tracker.description or ""
    locked_char = Character.objects.select_for_update().get(pk=character.pk)
    if amount > 0 and clock_key:
        _grant_clock(locked_char, clock_key, amount)
    elif amount > 0 and "Session end (pool)" in desc:
        locked_char.unallocated_xp = int(getattr(locked_char, "unallocated_xp", 0) or 0) + amount
        locked_char.save(update_fields=["unallocated_xp"])

    tracker.revoked_at = None
    tracker.revoked_by = None
    tracker.save(update_fields=["revoked_at", "revoked_by"])

    mirror = _find_mirror_history_for_revoked_tracker(
        character, tracker, gm_id=gm_user.id
    )
    if mirror:
        mirror.reverted_at = None
        mirror.reverted_by = None
        mirror.save(update_fields=["reverted_at", "reverted_by"])


def latest_gm_redo_target(character: Character, gm_user):
    """Newest revoked GM tracker award only (sheet edits use sheet redo)."""
    if not _gm_may_undo_pc(gm_user, character):
        return None, None

    tracker = (
        ExperienceTracker.objects.filter(
            character=character,
            awarded_by_id=gm_user.id,
            award_source="GM",
            revoked_at__isnull=False,
        )
        .order_by("-revoked_at", "-id")
        .first()
    )
    if not tracker:
        return None, None
    return "tracker", tracker


def gm_redo_status(character: Character, gm_user) -> dict:
    kind, obj = latest_gm_redo_target(character, gm_user)
    if not obj:
        return {"available": False, "summary": None, "kind": None}
    return {
        "available": True,
        "summary": _summarize_gm_undo(kind, obj),
        "kind": kind,
        "target_id": obj.id,
    }


@transaction.atomic
def redo_latest_gm_change(character: Character, *, gm_user) -> dict:
    if not _gm_may_undo_pc(gm_user, character):
        raise CharacterHistoryUndoError(
            "Only the campaign GM can redo their XP awards on a player's character."
        )

    kind, target = latest_gm_redo_target(character, gm_user)
    if not target:
        raise CharacterHistoryUndoError("No GM XP award to redo on this character.")

    if kind != "tracker":
        raise CharacterHistoryUndoError("No GM XP award to redo on this character.")
    redo_gm_tracker_entry(target, gm_user=gm_user)

    character.refresh_from_db()
    return {
        "kind": kind,
        "target_id": target.id,
        "status": gm_redo_status(character, gm_user),
    }


@transaction.atomic
def undo_latest_gm_change(character: Character, *, gm_user) -> dict:
    if not _gm_may_undo_pc(gm_user, character):
        raise CharacterHistoryUndoError(
            "Only the campaign GM can undo their XP awards on a player's character."
        )

    kind, target = latest_gm_undo_target(character, gm_user)
    if not target:
        raise CharacterHistoryUndoError("No GM XP award to undo on this character.")

    if kind != "tracker":
        raise CharacterHistoryUndoError("No GM XP award to undo on this character.")
    undo_gm_tracker_entry(target, gm_user=gm_user)

    character.refresh_from_db()
    return {
        "kind": kind,
        "target_id": target.id,
        "status": gm_undo_status(character, gm_user),
    }
