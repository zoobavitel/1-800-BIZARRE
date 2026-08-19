"""Reversible XP allocation (level-up, minor advance) for player characters."""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import Ability, Character, CharacterXPAllocation, Stand

XP_TRACKS = ("insight", "prowess", "resolve", "heritage", "playbook")
TRACK_CAPS = {
    "insight": 5,
    "prowess": 5,
    "resolve": 5,
    "heritage": 5,
    "playbook": 10,
}
LEVEL_UP_COST = 10
MINOR_ADVANCE_COST = 5

STAND_STAT_FIELDS = (
    "power",
    "speed",
    "range",
    "durability",
    "precision",
    "development",
)

GRADES = ("F", "D", "C", "B", "A", "S")

FRONTEND_ACTION_TO_BACKEND = {
    "HUNT": "hunt",
    "STUDY": "study",
    "SURVEY": "survey",
    "TINKER": "tinker",
    "FINESSE": "finesse",
    "PROWL": "prowl",
    "SKIRMISH": "skirmish",
    "WRECK": "wreck",
    "BIZARRE": "bizarre",
    "COMMAND": "command",
    "CONSORT": "consort",
    "SWAY": "sway",
}


class XPAllocationError(Exception):
    """User-facing allocation failure."""

    def __init__(self, message, code="invalid"):
        super().__init__(message)
        self.message = message
        self.code = code


def _normalize_track(track):
    t = str(track or "").strip().lower()
    if t not in XP_TRACKS:
        raise XPAllocationError(f"Invalid XP track: {track}")
    return t


def _normalize_stand_stat(stat):
    s = str(stat or "").strip().lower()
    if s not in STAND_STAT_FIELDS:
        raise XPAllocationError(f"Invalid Stand stat: {stat}")
    return s


def _normalize_action(action):
    raw = str(action or "").strip()
    if not raw:
        raise XPAllocationError("Action name is required.")
    upper = raw.upper()
    if upper in FRONTEND_ACTION_TO_BACKEND:
        return FRONTEND_ACTION_TO_BACKEND[upper]
    lower = raw.lower()
    if lower in FRONTEND_ACTION_TO_BACKEND.values():
        return lower
    raise XPAllocationError(f"Unknown action: {action}")


def _grade_index(grade):
    g = str(grade or "F").upper()[:1]
    try:
        return GRADES.index(g)
    except ValueError:
        return 0


def _bump_grade(grade):
    idx = _grade_index(grade)
    if idx >= len(GRADES) - 1:
        raise XPAllocationError(f"Cannot raise grade beyond {GRADES[-1]}.")
    return GRADES[idx + 1]


def _lower_grade(grade):
    idx = _grade_index(grade)
    if idx <= 0:
        return GRADES[0]
    return GRADES[idx - 1]


def _get_stand_grades(character):
    grades = {}
    try:
        if hasattr(character, "stand") and character.stand:
            stand = character.stand
            for field in STAND_STAT_FIELDS:
                grades[field] = str(getattr(stand, field, "D")).upper()[:1]
    except Exception:
        pass
    if not grades and character.coin_stats:
        for field in STAND_STAT_FIELDS:
            val = character.coin_stats.get(field)
            if val is not None:
                grades[field] = str(val).upper()[:1]
    for field in STAND_STAT_FIELDS:
        grades.setdefault(field, "D")
    return grades


def _set_stand_grade(character, field, grade):
    grade = str(grade).upper()[:1]
    if grade not in GRADES:
        raise XPAllocationError(f"Invalid grade: {grade}")
    coin_stats = dict(character.coin_stats or {})
    coin_stats[field] = grade
    character.coin_stats = coin_stats
    try:
        if hasattr(character, "stand") and character.stand:
            setattr(character.stand, field, grade)
            character.stand.save(update_fields=[field])
    except Exception:
        pass


def _snapshot(character):
    action_dots = dict(character.action_dots or {})
    return {
        "xp_clocks": dict(character.xp_clocks or {}),
        "coin_stats": _get_stand_grades(character),
        "action_dots": action_dots,
        "standard_ability_ids": list(
            character.standard_abilities.values_list("id", flat=True)
        ),
        "advancement_ability_grants": list(
            character.advancement_ability_grants or []
        ),
        "total_xp_spent": int(character.total_xp_spent or 0),
        "stand_coin_points_gained": int(character.stand_coin_points_gained or 0),
        "action_dice_gained": int(character.action_dice_gained or 0),
        "heritage_points_gained": int(character.heritage_points_gained or 0),
        "bonus_hp_from_xp": int(character.bonus_hp_from_xp or 0),
        "unallocated_xp": int(character.unallocated_xp or 0),
    }


def _restore_snapshot(character, snap, *, restore_xp_clocks=True):
    if restore_xp_clocks:
        character.xp_clocks = dict(snap.get("xp_clocks") or {})
    for field, grade in (snap.get("coin_stats") or {}).items():
        if field in STAND_STAT_FIELDS:
            _set_stand_grade(character, field, grade)
    character.action_dots = dict(snap.get("action_dots") or {})
    character.total_xp_spent = int(snap.get("total_xp_spent") or 0)
    character.stand_coin_points_gained = int(snap.get("stand_coin_points_gained") or 0)
    character.action_dice_gained = int(snap.get("action_dice_gained") or 0)
    character.heritage_points_gained = int(snap.get("heritage_points_gained") or 0)
    character.bonus_hp_from_xp = int(snap.get("bonus_hp_from_xp") or 0)
    if "unallocated_xp" in snap:
        character.unallocated_xp = int(snap.get("unallocated_xp") or 0)
    character.advancement_ability_grants = list(
        snap.get("advancement_ability_grants") or []
    )
    std_ids = snap.get("standard_ability_ids") or []
    character.standard_abilities.set(std_ids)


def _spend_xp(character, track, cost):
    track = _normalize_track(track)
    clocks = dict(character.xp_clocks or {})
    current = int(clocks.get(track, 0) or 0)
    if current < cost:
        raise XPAllocationError(
            f"Not enough XP on {track} track (have {current}, need {cost})."
        )
    clocks[track] = current - cost
    character.xp_clocks = clocks


def _spend_xp_source(character, *, xp_track=None, from_pool=False, cost):
    """Spend ``cost`` from free pool or from a named track. Returns source label."""
    if from_pool:
        pool = int(character.unallocated_xp or 0)
        if pool < cost:
            raise XPAllocationError(
                f"Not enough XP in free pool (have {pool}, need {cost})."
            )
        character.unallocated_xp = pool - cost
        return "pool"
    track = _normalize_track(xp_track)
    _spend_xp(character, track, cost)
    return track


def _refund_xp(character, track, cost):
    track = _normalize_track(track)
    clocks = dict(character.xp_clocks or {})
    current = int(clocks.get(track, 0) or 0)
    new_val = current + cost
    # Innate stand-dice XP can push playbook past 10; refunds must restore overflow.
    if track != "playbook":
        cap = TRACK_CAPS[track]
        if new_val > cap:
            raise XPAllocationError(
                f"Cannot refund {cost} XP to {track}: would exceed cap ({cap})."
            )
    clocks[track] = new_val
    character.xp_clocks = clocks


def _refund_xp_for_undo(character, track, cost):
    """Refund a spend on undo without clobbering GM grants on other tracks.

    Adds ``cost`` back to the spent track only. Attribute/heritage tracks clamp
    at TRACK_CAPS; playbook is uncapped so innate overflow survives Take advance
    undo. Does not restore the full ``payload_before`` clocks snapshot.
    """
    track = _normalize_track(track)
    clocks = dict(character.xp_clocks or {})
    current = int(clocks.get(track, 0) or 0)
    added = current + int(cost or 0)
    if track == "playbook":
        clocks[track] = added
    else:
        cap = TRACK_CAPS[track]
        clocks[track] = min(cap, added)
    character.xp_clocks = clocks


def _bump_action_dot(character, action_key, delta=1):
    dots = dict(character.action_dots or {})
    cur = int(dots.get(action_key, 0) or 0)
    new_val = cur + delta
    if new_val < 0:
        raise XPAllocationError(f"Cannot reduce {action_key} below 0.")
    if new_val > 4:
        raise XPAllocationError(f"Action {action_key} cannot exceed 4 dots.")
    dots[action_key] = new_val
    character.action_dots = dots


def _apply_b_to_a_reward(character, allocation_id, reward):
    branch = str(reward.get("branch") or "").strip().lower()
    added_standard = []

    if branch == "custom2plus1standard":
        custom_name = str(reward.get("custom_name") or "").strip()
        uses = reward.get("custom_uses") or []
        if not custom_name:
            raise XPAllocationError("Custom ability name is required for B→A reward.")
        if not isinstance(uses, list) or len(uses) < 2:
            raise XPAllocationError("Custom ability requires exactly 2 uses.")
        use_lines = [str(u or "").strip() for u in uses[:2]]
        if not all(use_lines):
            raise XPAllocationError("Both custom ability uses must be filled in.")
        std_id = reward.get("standard_ability_id")
        if not std_id:
            raise XPAllocationError("Standard ability is required for B→A reward.")
        try:
            ability = Ability.objects.get(pk=int(std_id))
        except (Ability.DoesNotExist, TypeError, ValueError):
            raise XPAllocationError("Invalid standard ability for B→A reward.")
        character.standard_abilities.add(ability)
        added_standard.append(ability.id)
        grants = list(character.advancement_ability_grants or [])
        grants.append(
            {
                "allocation_id": allocation_id,
                "custom_ability_type": "single_with_2_uses",
                "name": custom_name,
                "uses": use_lines,
            }
        )
        character.advancement_ability_grants = grants
    elif branch == "two_standard":
        ids = reward.get("standard_ability_ids") or []
        if not isinstance(ids, list) or len(ids) != 2:
            raise XPAllocationError("Two standard abilities are required for B→A reward.")
        for raw_id in ids:
            try:
                ability = Ability.objects.get(pk=int(raw_id))
            except (Ability.DoesNotExist, TypeError, ValueError):
                raise XPAllocationError("Invalid standard ability for B→A reward.")
            character.standard_abilities.add(ability)
            added_standard.append(ability.id)
    else:
        raise XPAllocationError(
            "B→A reward requires branch 'custom2plus1standard' or 'two_standard'."
        )

    return added_standard


def allocation_summary(allocation):
    """Human-readable summary for API/UI."""
    meta = allocation.metadata or {}
    if meta.get("from_pool"):
        base = f"−{allocation.xp_cost} XP from free pool"
    else:
        track_label = allocation.get_xp_track_display()
        base = f"−{allocation.xp_cost} XP from {track_label}"
    if allocation.allocation_type == "LEVEL_UP_STAT":
        stat = meta.get("stand_stat", "")
        old_g = meta.get("old_grade", "")
        new_g = meta.get("new_grade", "")
        detail = f"+1 {stat.upper()} ({old_g}→{new_g})"
        if meta.get("b_to_a_reward"):
            detail += f" · B→A reward ({meta.get('reward_branch', '')})"
        return f"{base} · {detail}"
    if allocation.allocation_type == "LEVEL_UP_DOTS":
        actions = meta.get("actions") or []
        return f"{base} · +2 dots ({', '.join(actions)})"
    if allocation.allocation_type == "LEVEL_UP_HERITAGE":
        return f"{base} · +1 heritage ability"
    if allocation.allocation_type == "BUY_HP":
        return f"{base} · +1 HP"
    if allocation.allocation_type == "MINOR_ADVANCE":
        action = meta.get("action", "")
        return f"{base} · +1 {action.upper()} dot"
    return base


@transaction.atomic
def apply_level_up(
    character,
    *,
    xp_track,
    choice,
    stand_stat=None,
    actions=None,
    reward=None,
    defer_b_to_a_reward=False,
    from_pool=False,
):
    choice = str(choice or "").strip().lower()
    if choice not in ("stat", "dots", "heritage"):
        raise XPAllocationError("choice must be 'stat', 'dots', or 'heritage'.")

    before = _snapshot(character)
    source = _spend_xp_source(
        character, xp_track=xp_track, from_pool=from_pool, cost=LEVEL_UP_COST
    )
    # Model xp_track field requires a track key; pool spends store heritage as ledger tag.
    track = "heritage" if source == "pool" else _normalize_track(xp_track)
    character.total_xp_spent = int(character.total_xp_spent or 0) + LEVEL_UP_COST

    metadata = {
        "xp_track": track,
        "choice": choice,
        "from_pool": source == "pool",
    }
    allocation_type = None

    if choice == "stat":
        stat = _normalize_stand_stat(stand_stat)
        grades = _get_stand_grades(character)
        old_grade = grades.get(stat, "D")
        if old_grade == "S":
            raise XPAllocationError(f"{stat} is already S-rank.")
        if old_grade == "A" and not character.gm_can_have_s_rank_stand_stats:
            raise XPAllocationError(
                f"{stat} is already A-rank (max for PCs unless GM allows S)."
            )
        new_grade = _bump_grade(old_grade)
        if new_grade == "S" and not character.gm_can_have_s_rank_stand_stats:
            raise XPAllocationError("S-rank requires GM permission.")

        b_to_a = old_grade == "B" and new_grade == "A"
        if b_to_a and not reward and not defer_b_to_a_reward:
            raise XPAllocationError(
                "Raising a stat from B to A requires a reward choice."
            )

        _set_stand_grade(character, stat, new_grade)
        character.stand_coin_points_gained = (
            int(character.stand_coin_points_gained or 0) + 1
        )
        allocation_type = "LEVEL_UP_STAT"
        metadata.update(
            {
                "stand_stat": stat,
                "old_grade": old_grade,
                "new_grade": new_grade,
                "b_to_a_reward": b_to_a,
            }
        )

        allocation = CharacterXPAllocation.objects.create(
            character=character,
            allocation_type=allocation_type,
            xp_track=track,
            xp_cost=LEVEL_UP_COST,
            payload_before=before,
            payload_after={},
            metadata=metadata,
        )

        if b_to_a and reward:
            added = _apply_b_to_a_reward(character, allocation.id, reward)
            metadata["reward_branch"] = reward.get("branch")
            metadata["added_standard_ability_ids"] = added
            metadata["reward_pending"] = False
            allocation.metadata = metadata
            allocation.save(update_fields=["metadata"])
        elif b_to_a and defer_b_to_a_reward:
            metadata["reward_pending"] = True
            allocation.metadata = metadata
            allocation.save(update_fields=["metadata"])

    elif choice == "heritage":
        character.heritage_points_gained = (
            int(character.heritage_points_gained or 0) + 1
        )
        allocation_type = "LEVEL_UP_HERITAGE"
        allocation = CharacterXPAllocation.objects.create(
            character=character,
            allocation_type=allocation_type,
            xp_track=track,
            xp_cost=LEVEL_UP_COST,
            payload_before=before,
            payload_after={},
            metadata=metadata,
        )

    else:
        raw_actions = actions or []
        if not isinstance(raw_actions, list) or len(raw_actions) != 2:
            raise XPAllocationError("Level-up dots path requires exactly 2 actions.")
        backend_actions = [_normalize_action(a) for a in raw_actions]
        for action_key in backend_actions:
            _bump_action_dot(character, action_key, 1)
        character.action_dice_gained = int(character.action_dice_gained or 0) + 2
        allocation_type = "LEVEL_UP_DOTS"
        metadata["actions"] = backend_actions
        allocation = CharacterXPAllocation.objects.create(
            character=character,
            allocation_type=allocation_type,
            xp_track=track,
            xp_cost=LEVEL_UP_COST,
            payload_before=before,
            payload_after={},
            metadata=metadata,
        )

    after = _snapshot(character)
    allocation.payload_after = after
    allocation.save(update_fields=["payload_after"])
    character.save()
    allocation.refresh_from_db()
    return allocation


def get_pending_stand_a_reward(character):
    """Newest non-undone LEVEL_UP_STAT with B→A reward still unpaid."""
    for allocation in list_allocations(character):
        meta = allocation.metadata or {}
        if (
            allocation.allocation_type == "LEVEL_UP_STAT"
            and meta.get("b_to_a_reward")
            and meta.get("reward_pending")
        ):
            return {
                "allocation_id": allocation.id,
                "stand_stat": meta.get("stand_stat"),
                "old_grade": meta.get("old_grade"),
                "new_grade": meta.get("new_grade"),
                "gm_forced": bool(meta.get("gm_forced")),
                "xp_track": allocation.xp_track,
            }
    return None


@transaction.atomic
def complete_pending_stand_a_reward(character, *, allocation_id, reward):
    """Player (or GM) claims deferred B→A ability reward for an allocation."""
    try:
        allocation_id = int(allocation_id)
    except (TypeError, ValueError):
        raise XPAllocationError("allocation_id is required.")

    try:
        allocation = CharacterXPAllocation.objects.select_for_update().get(
            pk=allocation_id,
            character=character,
            undone_at__isnull=True,
        )
    except CharacterXPAllocation.DoesNotExist:
        raise XPAllocationError("Pending Stand A reward allocation not found.")

    meta = dict(allocation.metadata or {})
    if not meta.get("b_to_a_reward") or not meta.get("reward_pending"):
        raise XPAllocationError("This allocation has no pending B→A reward.")

    added = _apply_b_to_a_reward(character, allocation.id, reward)
    meta["reward_branch"] = reward.get("branch")
    meta["added_standard_ability_ids"] = added
    meta["reward_pending"] = False
    allocation.metadata = meta
    allocation.payload_after = _snapshot(character)
    allocation.save(update_fields=["metadata", "payload_after"])
    character.save()
    allocation.refresh_from_db()
    return allocation


@transaction.atomic
def apply_gm_forced_stand_stat(
    character,
    *,
    stand_stat,
    reward=None,
    xp_track="playbook",
):
    """
    GM force +1 Stand Coin grade as a full playbook advance.

    If the chosen track lacks LEVEL_UP_COST XP, top it up to the cost first
    (capped at the track maximum) so the spend matches a normal advance.

    B→A: when reward is omitted, defer ability picks to the player sheet
    (reward_pending on the allocation). Passing reward still applies immediately.
    """
    track = _normalize_track(xp_track)
    stat = _normalize_stand_stat(stand_stat)
    grades = _get_stand_grades(character)
    old_grade = grades.get(stat, "D")
    defer_b_to_a = old_grade == "B" and not reward

    clocks = dict(character.xp_clocks or {})
    current = int(clocks.get(track, 0) or 0)
    granted = 0
    if current < LEVEL_UP_COST:
        cap = TRACK_CAPS[track]
        target = min(cap, LEVEL_UP_COST)
        if target < LEVEL_UP_COST:
            raise XPAllocationError(
                f"Cannot GM-force stand advance: {track} track cap is {cap}."
            )
        granted = target - current
        clocks[track] = target
        character.xp_clocks = clocks
        character.save(update_fields=["xp_clocks"])

    allocation = apply_level_up(
        character,
        xp_track=track,
        choice="stat",
        stand_stat=stat,
        reward=reward,
        defer_b_to_a_reward=defer_b_to_a,
    )
    meta = dict(allocation.metadata or {})
    meta["gm_forced"] = True
    if granted:
        meta["gm_forced_xp_granted"] = granted
    allocation.metadata = meta
    allocation.save(update_fields=["metadata"])
    allocation.refresh_from_db()
    return allocation


@transaction.atomic
def apply_minor_advance(character, *, xp_track, action, from_pool=False):
    action_key = _normalize_action(action)

    before = _snapshot(character)
    source = _spend_xp_source(
        character,
        xp_track=xp_track,
        from_pool=from_pool,
        cost=MINOR_ADVANCE_COST,
    )
    track = "heritage" if source == "pool" else _normalize_track(xp_track)
    character.total_xp_spent = int(character.total_xp_spent or 0) + MINOR_ADVANCE_COST
    _bump_action_dot(character, action_key, 1)
    character.action_dice_gained = int(character.action_dice_gained or 0) + 1

    allocation = CharacterXPAllocation.objects.create(
        character=character,
        allocation_type="MINOR_ADVANCE",
        xp_track=track,
        xp_cost=MINOR_ADVANCE_COST,
        payload_before=before,
        payload_after={},
        metadata={
            "action": action_key,
            "xp_track": track,
            "from_pool": source == "pool",
        },
    )
    after = _snapshot(character)
    allocation.payload_after = after
    allocation.save(update_fields=["payload_after"])
    character.save()
    allocation.refresh_from_db()
    return allocation


@transaction.atomic
def apply_buy_hp(character, *, xp_track=None, from_pool=False):
    """Spend 5 XP (track or free pool) for +1 bonus HP (heritage option)."""
    before = _snapshot(character)
    source = _spend_xp_source(
        character,
        xp_track=xp_track or "heritage",
        from_pool=from_pool,
        cost=MINOR_ADVANCE_COST,
    )
    track = "heritage" if source == "pool" else _normalize_track(xp_track or "heritage")
    character.total_xp_spent = int(character.total_xp_spent or 0) + MINOR_ADVANCE_COST
    character.bonus_hp_from_xp = int(character.bonus_hp_from_xp or 0) + 1

    allocation = CharacterXPAllocation.objects.create(
        character=character,
        allocation_type="BUY_HP",
        xp_track=track,
        xp_cost=MINOR_ADVANCE_COST,
        payload_before=before,
        payload_after={},
        metadata={"from_pool": source == "pool", "xp_track": track},
    )
    after = _snapshot(character)
    allocation.payload_after = after
    allocation.save(update_fields=["payload_after"])
    character.save()
    allocation.refresh_from_db()
    return allocation


@transaction.atomic
def undo_allocation(character, allocation, *, user=None):
    if allocation.undone_at:
        raise XPAllocationError("This allocation was already undone.")
    if allocation.character_id != character.id:
        raise XPAllocationError("Allocation does not belong to this character.")

    latest = (
        CharacterXPAllocation.objects.filter(
            character=character, undone_at__isnull=True
        )
        .order_by("-created_at", "-id")
        .first()
    )
    if latest and latest.id != allocation.id:
        raise XPAllocationError(
            "Undo the most recent allocation first (newest spend first)."
        )

    _restore_snapshot(character, allocation.payload_before, restore_xp_clocks=False)
    _refund_xp_for_undo(character, allocation.xp_track, allocation.xp_cost)
    character.save()
    allocation.undone_at = timezone.now()
    allocation.undone_by = user
    allocation.save(update_fields=["undone_at", "undone_by"])
    return allocation


@transaction.atomic
def redo_allocation(character, allocation, *, user=None):
    if not allocation.undone_at:
        raise XPAllocationError("This allocation is active (not undone).")
    if allocation.character_id != character.id:
        raise XPAllocationError("Allocation does not belong to this character.")

    latest_undone = (
        CharacterXPAllocation.objects.filter(
            character=character, undone_at__isnull=False
        )
        .order_by("-undone_at", "-id")
        .first()
    )
    if not latest_undone or latest_undone.id != allocation.id:
        raise XPAllocationError(
            "Redo the most recently undone allocation first."
        )

    after = allocation.payload_after or {}
    if not after:
        raise XPAllocationError("Cannot redo: missing post-spend snapshot.")

    _restore_snapshot(character, after)
    character.save()
    allocation.undone_at = None
    allocation.undone_by = None
    allocation.save(update_fields=["undone_at", "undone_by"])
    return allocation


def list_allocations(character, *, include_undone=False):
    qs = CharacterXPAllocation.objects.filter(character=character)
    if not include_undone:
        qs = qs.filter(undone_at__isnull=True)
    return qs.order_by("-created_at", "-id")
