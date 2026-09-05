"""Advancement plan CRUD validation and queue helpers (Plan B).

Does not mint XP or rebuild credit_xp — consumes PendingAdvance + apply_level_up.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models import Max

from characters.models import AdvancementPlanItem, Character
from characters.services.advancement import TRACK_CAPS, AdvancementError
from characters.services.xp_allocation import (
    GRADES,
    XPAllocationError,
    _bump_grade,
    _normalize_stand_stat,
    character_has_acquired_stand,
)

PLAN_KINDS = (
    AdvancementPlanItem.KIND_ACTION_DOT,
    AdvancementPlanItem.KIND_COIN_GRADE,
    AdvancementPlanItem.KIND_ABILITY,
    AdvancementPlanItem.KIND_ACQUIRE_STAND,
)

A_GRANT_BRANCHES = ("two_standard", "two_unique_plus_one_standard")
# PC Coin ceiling is A unless GM flag; S is never a normal plan target.
PC_COIN_CEILING = "A"


class PlanQueueError(AdvancementError):
    """User-facing plan CRUD / legality failure."""


def _track_for_kind(kind: str, track: str) -> str:
    key = str(track or "").strip().lower()
    kind = str(kind or "").strip().lower()
    if key not in TRACK_CAPS:
        raise PlanQueueError(f"Invalid XP track: {track}")
    if kind == AdvancementPlanItem.KIND_ACTION_DOT:
        if key not in ("insight", "prowess", "resolve"):
            raise PlanQueueError(
                "action_dot plans must use insight, prowess, or resolve."
            )
    elif kind in (
        AdvancementPlanItem.KIND_COIN_GRADE,
        AdvancementPlanItem.KIND_ABILITY,
        AdvancementPlanItem.KIND_ACQUIRE_STAND,
    ):
        if key != "playbook":
            raise PlanQueueError(f"{kind} plans must use the playbook track.")
    return key


def _normalize_a_grant(a_grant) -> dict | None:
    if a_grant is None:
        return None
    if not isinstance(a_grant, dict):
        raise PlanQueueError("a_grant must be an object.")
    branch = str(a_grant.get("branch") or "").strip().lower()
    if branch == "custom2plus1standard":
        branch = "two_unique_plus_one_standard"
    if branch not in A_GRANT_BRANCHES:
        raise PlanQueueError(
            "a_grant.branch must be 'two_standard' or "
            "'two_unique_plus_one_standard'."
        )
    out = {"branch": branch}
    if branch == "two_standard":
        ids = a_grant.get("standard_ability_ids") or []
        if not isinstance(ids, list) or len(ids) != 2:
            raise PlanQueueError(
                "two_standard a_grant requires exactly 2 standard_ability_ids."
            )
        out["standard_ability_ids"] = [int(x) for x in ids]
    else:
        uniques = a_grant.get("unique_abilities")
        if not isinstance(uniques, list) or len(uniques) != 2:
            raise PlanQueueError(
                "two_unique_plus_one_standard requires exactly 2 unique_abilities."
            )
        out["unique_abilities"] = uniques
        std_id = a_grant.get("standard_ability_id")
        if std_id is None:
            raise PlanQueueError(
                "two_unique_plus_one_standard requires standard_ability_id."
            )
        out["standard_ability_id"] = int(std_id)
    return out


def _owned_coin_grade(character, stat: str) -> str:
    stand = getattr(character, "stand", None)
    if stand is None and not character_has_acquired_stand(character):
        raise PlanQueueError("Acquire a Stand before planning Coin grades.")
    old = str(getattr(stand, stat, "F") or "F").upper()
    return old if old in GRADES else "F"


def _effective_coin_grade_with_queue(character, stat: str) -> str:
    """Owned grade plus already-queued coin_grade bumps for this stat (order)."""
    grade = _owned_coin_grade(character, stat)
    if not getattr(character, "pk", None):
        return grade
    queued = (
        AdvancementPlanItem.objects.filter(
            character=character,
            track="playbook",
            kind=AdvancementPlanItem.KIND_COIN_GRADE,
            status=AdvancementPlanItem.STATUS_QUEUED,
        )
        .order_by("order", "id")
        .only("payload")
    )
    for item in queued:
        payload = item.payload or {}
        if str(payload.get("stat") or "").strip().lower() != stat:
            continue
        to_g = str(payload.get("to_grade") or "").upper()[:1]
        if to_g in GRADES:
            grade = to_g
        else:
            try:
                grade = _bump_grade(grade)
            except XPAllocationError:
                break
    return grade


def _coin_next_grade(
    character, stat: str, *, from_grade: str | None = None
) -> tuple[str, str, bool]:
    """Return (old_grade, new_grade, lands_on_a). Raises if illegal for PC."""
    old = str(from_grade or _owned_coin_grade(character, stat)).upper()
    if old not in GRADES:
        old = "F"
    allow_s = bool(getattr(character, "gm_can_have_s_rank_stand_stats", False))
    if old == PC_COIN_CEILING and not allow_s:
        raise PlanQueueError(
            f"{stat} is already A-rank (max for PCs unless GM allows S)."
        )
    if old == "S":
        raise PlanQueueError(f"{stat} is already S-rank.")
    try:
        new = _bump_grade(old)
    except XPAllocationError as exc:
        raise PlanQueueError(exc.message) from exc
    if new == "S" and not allow_s:
        raise PlanQueueError(
            "A is the player ceiling; S is GM-only."
        )
    lands_on_a = old == "B" and new == "A"
    return old, new, lands_on_a


def normalize_plan_payload(character, *, kind: str, track: str, payload) -> dict:
    """Validate and normalize payload for CRUD. Raises PlanQueueError."""
    kind = str(kind or "").strip().lower()
    if kind not in PLAN_KINDS:
        raise PlanQueueError(
            "kind must be action_dot, coin_grade, ability, or acquire_stand."
        )
    track = _track_for_kind(kind, track)
    raw = payload if isinstance(payload, dict) else {}

    if kind == AdvancementPlanItem.KIND_ACTION_DOT:
        action = str(raw.get("action") or "").strip().lower()
        if not action:
            raise PlanQueueError("action_dot requires payload.action.")
        allowed = set()
        for acts in Character.ACTION_CATEGORIES.values():
            allowed.update(str(a).lower() for a in acts)
        if action not in allowed:
            raise PlanQueueError(f"Unknown action: {action}.")
        track_actions = [
            str(a).lower() for a in Character.ACTION_CATEGORIES.get(track, [])
        ]
        if track_actions and action not in track_actions:
            raise PlanQueueError(
                f"Action '{action}' is not under the {track} attribute."
            )
        return {"action": action}

    if kind == AdvancementPlanItem.KIND_COIN_GRADE:
        try:
            stat = _normalize_stand_stat(raw.get("stat"))
            # Chain from owned + already-queued bumps so D→C, C→B, B→A stack.
            effective = _effective_coin_grade_with_queue(character, stat)
            old, new, lands_on_a = _coin_next_grade(
                character, stat, from_grade=effective
            )
        except XPAllocationError as exc:
            raise PlanQueueError(exc.message) from exc
        a_grant = raw.get("a_grant")
        if lands_on_a:
            if a_grant is None:
                raise PlanQueueError(
                    "coin_grade that lands on A requires a_grant "
                    "(two_standard or two_unique_plus_one_standard)."
                )
            a_grant = _normalize_a_grant(a_grant)
        elif a_grant is not None:
            raise PlanQueueError(
                "a_grant is only valid when the bump lands on A (B→A)."
            )
        out = {
            "stat": stat,
            "from_grade": old,
            "to_grade": new,
        }
        if a_grant is not None:
            out["a_grant"] = a_grant
            out["a_grant_child_count"] = (
                2 if a_grant["branch"] == "two_standard" else 3
            )
        return out

    if kind == AdvancementPlanItem.KIND_ABILITY:
        ability_id = raw.get("ability_id")
        if ability_id is None:
            raise PlanQueueError("ability requires payload.ability_id.")
        ability_source = str(raw.get("ability_source") or "").strip().lower()
        # standard | spin | hamon | playbook — optional hint for UI
        if ability_source and ability_source not in (
            "standard",
            "spin",
            "hamon",
            "playbook",
            "custom",
        ):
            raise PlanQueueError("Invalid ability_source.")
        if ability_source == "custom":
            raise PlanQueueError(
                "Custom abilities cannot be queued as a top-level plan item; "
                "use them only inside a coin_grade A-grant or acquire_stand."
            )
        return {
            "ability_id": int(ability_id),
            "ability_source": ability_source or None,
            "ability_name": str(raw.get("ability_name") or "").strip() or None,
        }

    # acquire_stand
    if character_has_acquired_stand(character):
        raise PlanQueueError("This character already has a Stand.")
    unique_id = raw.get("unique_ability_id")
    if unique_id is None:
        raise PlanQueueError("acquire_stand requires payload.unique_ability_id.")
    coin_spread = raw.get("coin_spread")
    if not isinstance(coin_spread, dict):
        raise PlanQueueError(
            "acquire_stand requires payload.coin_spread (six Coin grades)."
        )
    return {
        "unique_ability_id": int(unique_id),
        "coin_spread": coin_spread,
    }


def serialize_plan_item(item: AdvancementPlanItem) -> dict:
    return {
        "id": item.id,
        "track": item.track,
        "order": item.order,
        "kind": item.kind,
        "payload": item.payload or {},
        "blocked_reason": item.blocked_reason or "",
        "status": item.status,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "applied_at": item.applied_at.isoformat() if item.applied_at else None,
        "applied_allocation_id": item.applied_allocation_id,
    }


def list_queued_plan_items(character):
    return list(
        AdvancementPlanItem.objects.filter(
            character=character,
            status=AdvancementPlanItem.STATUS_QUEUED,
        ).order_by("track", "order", "id")
    )


@transaction.atomic
def create_plan_item(character, *, track: str, kind: str, payload=None) -> AdvancementPlanItem:
    kind = str(kind or "").strip().lower()
    track = _track_for_kind(kind, track)
    normalized = normalize_plan_payload(
        character, kind=kind, track=track, payload=payload or {}
    )
    max_order = (
        AdvancementPlanItem.objects.filter(
            character=character,
            track=track,
            status=AdvancementPlanItem.STATUS_QUEUED,
        ).aggregate(m=Max("order"))["m"]
        or 0
    )
    return AdvancementPlanItem.objects.create(
        character=character,
        track=track,
        order=max_order + 1,
        kind=kind,
        payload=normalized,
        status=AdvancementPlanItem.STATUS_QUEUED,
    )


@transaction.atomic
def update_plan_item(item: AdvancementPlanItem, *, payload=None, blocked_reason=None):
    if item.status != AdvancementPlanItem.STATUS_QUEUED:
        raise PlanQueueError("Only queued plan items can be edited.")
    if payload is not None:
        item.payload = normalize_plan_payload(
            item.character, kind=item.kind, track=item.track, payload=payload
        )
    if blocked_reason is not None:
        item.blocked_reason = str(blocked_reason)[:255]
    item.save()
    return item


@transaction.atomic
def delete_plan_item(item: AdvancementPlanItem):
    if item.status != AdvancementPlanItem.STATUS_QUEUED:
        raise PlanQueueError("Only queued plan items can be deleted.")
    item.delete()


@transaction.atomic
def reorder_plan_items(character, track: str, ordered_ids: list[int]):
    track = str(track or "").strip().lower()
    if track not in TRACK_CAPS:
        raise PlanQueueError(f"Invalid XP track: {track}")
    if not isinstance(ordered_ids, list) or not ordered_ids:
        raise PlanQueueError("ordered_ids must be a non-empty list.")
    qs = list(
        AdvancementPlanItem.objects.select_for_update().filter(
            character=character,
            track=track,
            status=AdvancementPlanItem.STATUS_QUEUED,
        )
    )
    by_id = {i.id: i for i in qs}
    if set(ordered_ids) != set(by_id.keys()):
        raise PlanQueueError(
            "ordered_ids must include every queued item on this track exactly once."
        )
    for idx, pk in enumerate(ordered_ids, start=1):
        item = by_id[pk]
        if item.order != idx:
            item.order = idx
            item.save(update_fields=["order"])
    return list_queued_plan_items(character)


def _set_blocked(item: AdvancementPlanItem, reason: str) -> None:
    text = str(reason or "")[:255]
    if item.blocked_reason != text:
        item.blocked_reason = text
        item.save(update_fields=["blocked_reason"])


def _clear_blocked(item: AdvancementPlanItem) -> None:
    if item.blocked_reason:
        item.blocked_reason = ""
        item.save(update_fields=["blocked_reason"])


def _mark_plan_applied(item: AdvancementPlanItem, allocation) -> None:
    from django.utils import timezone
    from characters.models import PendingAdvance

    item.status = AdvancementPlanItem.STATUS_APPLIED
    item.applied_at = timezone.now()
    item.applied_allocation = allocation
    item.blocked_reason = ""
    item.save(
        update_fields=[
            "status",
            "applied_at",
            "applied_allocation",
            "blocked_reason",
        ]
    )
    pending_id = (allocation.metadata or {}).get("pending_id")
    if pending_id:
        PendingAdvance.objects.filter(pk=pending_id).update(
            status=PendingAdvance.STATUS_APPLIED
        )


def _attach_planned_ability(character, payload: dict) -> None:
    from characters.models import (
        Ability,
        CharacterHamonAbility,
        CharacterSpinAbility,
        HamonAbility,
        SpinAbility,
    )

    ability_id = int(payload.get("ability_id"))
    source = str(payload.get("ability_source") or "").strip().lower()

    if source == "standard" or (not source and Ability.objects.filter(pk=ability_id).exists()):
        ability = Ability.objects.filter(pk=ability_id).first()
        if ability is None:
            raise PlanQueueError(f"Standard ability {ability_id} not found.")
        character.standard_abilities.add(ability)
        return

    if source == "hamon" or HamonAbility.objects.filter(pk=ability_id).exists():
        ha = HamonAbility.objects.filter(pk=ability_id).first()
        if ha is None:
            raise PlanQueueError(f"Hamon ability {ability_id} not found.")
        CharacterHamonAbility.objects.get_or_create(
            character=character,
            hamon_ability=ha,
            defaults={"acquired_at_creation": False},
        )
        return

    if source == "spin" or SpinAbility.objects.filter(pk=ability_id).exists():
        sa = SpinAbility.objects.filter(pk=ability_id).first()
        if sa is None:
            raise PlanQueueError(f"Spin ability {ability_id} not found.")
        CharacterSpinAbility.objects.get_or_create(
            character=character,
            spin_ability=sa,
            defaults={"acquired_at_creation": False},
        )
        return

    raise PlanQueueError(f"Could not resolve ability_id={ability_id}.")


def _apply_one_plan_item(character, item: AdvancementPlanItem):
    """Apply one queued item. Raises PlanQueueError / XPAllocationError if illegal."""
    from characters.services.xp_allocation import (
        apply_level_up,
        apply_minor_advance,
    )

    payload = item.payload or {}
    kind = item.kind

    if kind == AdvancementPlanItem.KIND_ACTION_DOT:
        action = payload.get("action")
        dots = character.action_dots or {}
        if int(dots.get(action, 0) or 0) >= 4:
            raise PlanQueueError(f"{action} is already at max rating (4).")
        return apply_minor_advance(
            character, xp_track=item.track, action=action, from_pool=False
        )

    if kind == AdvancementPlanItem.KIND_COIN_GRADE:
        # Re-validate bump against live grades (may have drifted).
        live = normalize_plan_payload(
            character,
            kind=kind,
            track=item.track,
            payload={
                "stat": payload.get("stat"),
                "a_grant": payload.get("a_grant"),
            },
        )
        reward = live.get("a_grant")
        return apply_level_up(
            character,
            xp_track="playbook",
            choice="stat",
            stand_stat=live.get("stat"),
            reward=reward,
            from_pool=False,
        )

    if kind == AdvancementPlanItem.KIND_ABILITY:
        allocation = apply_level_up(
            character,
            xp_track="playbook",
            choice="playbook_ability",
            from_pool=False,
        )
        _attach_planned_ability(character, payload)
        character.save()
        return allocation

    if kind == AdvancementPlanItem.KIND_ACQUIRE_STAND:
        allocation = apply_level_up(
            character,
            xp_track="playbook",
            choice="acquire_stand",
            from_pool=False,
        )
        # Optional redistribute from planned spread (still within 6 points).
        coin_spread = payload.get("coin_spread")
        if isinstance(coin_spread, dict):
            from characters.services.xp_allocation import (
                STAND_STAT_FIELDS,
                _set_stand_grade,
            )

            for field in STAND_STAT_FIELDS:
                grade = coin_spread.get(field) or coin_spread.get(field.upper())
                if grade:
                    _set_stand_grade(character, field, str(grade).upper()[:1])
            character.save()
        return allocation

    raise PlanQueueError(f"Unknown plan kind: {kind}")


@transaction.atomic
def drain_and_walk_plan(character, track: str) -> dict:
    """
    For each open pending on track (oldest first), walk queued items in order
    and apply the first legal one. Blocked heads stay with blocked_reason.
    """
    from characters.models import PendingAdvance
    from characters.services.advancement import oldest_open_pending

    track = str(track or "").strip().lower()
    if track not in TRACK_CAPS:
        return {"applied": [], "blocked": []}

    applied = []
    blocked = []

    # Safety: avoid infinite loop if apply fails to consume pending.
    for _ in range(32):
        pending = oldest_open_pending(character, track)
        if pending is None:
            break

        items = list(
            AdvancementPlanItem.objects.select_for_update()
            .filter(
                character=character,
                track=track,
                status=AdvancementPlanItem.STATUS_QUEUED,
            )
            .order_by("order", "id")
        )
        if not items:
            break

        fired = None
        for item in items:
            try:
                allocation = _apply_one_plan_item(character, item)
                _mark_plan_applied(item, allocation)
                _clear_blocked(item)
                applied.append({"plan_item_id": item.id, "allocation_id": allocation.id})
                fired = item
                break
            except (PlanQueueError, XPAllocationError) as exc:
                msg = getattr(exc, "message", None) or str(exc)
                _set_blocked(item, msg)
                blocked.append({"plan_item_id": item.id, "reason": msg})
                continue

        if fired is None:
            # Nothing legal — leave pendings redeemable manually.
            break

        # If apply path failed to consume this pending, stop.
        pending.refresh_from_db()
        if pending.status == PendingAdvance.STATUS_OPEN:
            break

    return {"applied": applied, "blocked": blocked}
