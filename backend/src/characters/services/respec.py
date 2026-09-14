"""Respec mode: fold from chargen baseline + active allocations; commit diffs."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from characters.models import (
    Character,
    CharacterHamonAbility,
    CharacterSpinAbility,
    CharacterXPAllocation,
    HamonAbility,
    SpinAbility,
)
from characters.services.xp_allocation import (
    GRADES,
    LEVEL_UP_COST,
    MINOR_ADVANCE_COST,
    STAND_STAT_FIELDS,
    XPAllocationError,
    _bump_grade,
    _get_stand_grades,
    _grade_index,
    _normalize_action,
    _normalize_stand_stat,
    _normalize_track,
    list_allocations,
)


class RespecError(XPAllocationError):
    """User-facing respec failure."""


@dataclass
class RebuiltState:
    action_dots: dict = field(default_factory=dict)
    coin_stats: dict = field(default_factory=dict)
    standard_ability_ids: list = field(default_factory=list)
    spin_ability_ids: list = field(default_factory=list)
    hamon_ability_ids: list = field(default_factory=list)
    extra_custom_abilities: list = field(default_factory=list)
    advancement_ability_grants: list = field(default_factory=list)
    bonus_hp_from_xp: int = 0
    stand_coin_points_gained: int = 0
    action_dice_gained: int = 0
    heritage_points_gained: int = 0
    total_xp_spent: int = 0
    playbook_ability_slots: int = 1
    acquired_stand: bool = False
    selected_benefit_ids: list = field(default_factory=list)
    selected_detriment_ids: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "action_dots": dict(self.action_dots),
            "coin_stats": dict(self.coin_stats),
            "standard_ability_ids": list(self.standard_ability_ids),
            "spin_ability_ids": list(self.spin_ability_ids),
            "hamon_ability_ids": list(self.hamon_ability_ids),
            "extra_custom_abilities": list(self.extra_custom_abilities or []),
            "advancement_ability_grants": list(self.advancement_ability_grants or []),
            "bonus_hp_from_xp": int(self.bonus_hp_from_xp),
            "stand_coin_points_gained": int(self.stand_coin_points_gained),
            "action_dice_gained": int(self.action_dice_gained),
            "heritage_points_gained": int(self.heritage_points_gained),
            "total_xp_spent": int(self.total_xp_spent),
            "playbook_ability_slots": int(self.playbook_ability_slots),
            "acquired_stand": bool(self.acquired_stand),
            "selected_benefit_ids": list(self.selected_benefit_ids),
            "selected_detriment_ids": list(self.selected_detriment_ids),
        }


def capture_chargen_baseline(character: Character) -> dict:
    """Build a chargen baseline snapshot from the live character."""
    grades = _get_stand_grades(character)
    spin_ids = list(
        character.spin_abilities.values_list("spin_ability_id", flat=True)
    )
    hamon_ids = list(
        character.hamon_abilities.values_list("hamon_ability_id", flat=True)
    )
    benefit_ids = list(character.selected_benefits.values_list("id", flat=True))
    detriment_ids = list(character.selected_detriments.values_list("id", flat=True))
    return {
        "action_dots": dict(character.action_dots or {}),
        "coin_stats": dict(grades),
        "standard_ability_ids": list(
            character.standard_abilities.values_list("id", flat=True)
        ),
        "spin_ability_ids": [int(x) for x in spin_ids],
        "hamon_ability_ids": [int(x) for x in hamon_ids],
        "extra_custom_abilities": list(character.extra_custom_abilities or []),
        "advancement_ability_grants": [],
        "selected_benefit_ids": [int(x) for x in benefit_ids],
        "selected_detriment_ids": [int(x) for x in detriment_ids],
        "bonus_hp_from_xp": 0,
        "stand_coin_points_gained": 0,
        "action_dice_gained": 0,
        "heritage_points_gained": 0,
        "total_xp_spent": 0,
    }


def ensure_chargen_baseline(character: Character) -> dict:
    """Persist chargen_baseline once before the first XP allocation."""
    existing = character.chargen_baseline
    if isinstance(existing, dict) and existing.get("action_dots") is not None:
        return existing
    snap = capture_chargen_baseline(character)
    character.chargen_baseline = snap
    character.save(update_fields=["chargen_baseline"])
    return snap


def _state_from_baseline(baseline: dict | None, character: Character) -> RebuiltState:
    base = baseline if isinstance(baseline, dict) else {}
    pb = str(getattr(character, "playbook", None) or "STAND").upper()
    grades = dict(base.get("coin_stats") or {})
    for f in STAND_STAT_FIELDS:
        grades.setdefault(f, "D")
    return RebuiltState(
        action_dots=dict(base.get("action_dots") or {}),
        coin_stats=grades,
        standard_ability_ids=[int(x) for x in (base.get("standard_ability_ids") or [])],
        spin_ability_ids=[int(x) for x in (base.get("spin_ability_ids") or [])],
        hamon_ability_ids=[int(x) for x in (base.get("hamon_ability_ids") or [])],
        extra_custom_abilities=list(base.get("extra_custom_abilities") or []),
        advancement_ability_grants=[],
        bonus_hp_from_xp=int(base.get("bonus_hp_from_xp") or 0),
        stand_coin_points_gained=0,
        action_dice_gained=0,
        heritage_points_gained=0,
        total_xp_spent=0,
        playbook_ability_slots=1,
        acquired_stand=(pb == "STAND"),
        selected_benefit_ids=[int(x) for x in (base.get("selected_benefit_ids") or [])],
        selected_detriment_ids=[
            int(x) for x in (base.get("selected_detriment_ids") or [])
        ],
    )


def _bump_dot_state(state: RebuiltState, action_key: str, delta: int = 1) -> None:
    dots = dict(state.action_dots)
    cur = int(dots.get(action_key, 0) or 0)
    new_val = cur + delta
    if new_val < 0:
        raise RespecError(f"Cannot reduce {action_key} below 0.")
    if new_val > 4:
        raise RespecError(f"Action {action_key} cannot exceed 4 dots.")
    dots[action_key] = new_val
    state.action_dots = dots


def _apply_b_to_a_to_state(state: RebuiltState, allocation_id: int, reward: dict) -> list:
    branch = str(reward.get("branch") or "").strip().lower()
    if branch == "custom2plus1standard":
        branch = "two_unique_plus_one_standard"
    added = []
    if branch == "two_unique_plus_one_standard":
        entries = reward.get("unique_abilities")
        if not isinstance(entries, list) or len(entries) != 2:
            raise RespecError("B→A reward requires exactly 2 unique abilities.")
        std_id = reward.get("standard_ability_id")
        if not std_id:
            raise RespecError("Standard ability is required for B→A reward.")
        std_id = int(std_id)
        if std_id not in state.standard_ability_ids:
            state.standard_ability_ids.append(std_id)
        added.append(std_id)
        grants = list(state.advancement_ability_grants)
        for slot, entry in enumerate(entries):
            name = str((entry or {}).get("name") or "").strip()
            use = str((entry or {}).get("use") or "").strip()
            if not name or not use:
                raise RespecError("Each unique ability needs a name and function.")
            grants.append(
                {
                    "allocation_id": allocation_id,
                    "custom_ability_type": "single_with_1_use",
                    "slot": slot,
                    "name": name,
                    "uses": [use],
                }
            )
        state.advancement_ability_grants = grants
    elif branch == "two_standard":
        ids = reward.get("standard_ability_ids") or []
        if not isinstance(ids, list) or len(ids) != 2:
            raise RespecError("Two standard abilities are required for B→A reward.")
        for raw in ids:
            sid = int(raw)
            if sid not in state.standard_ability_ids:
                state.standard_ability_ids.append(sid)
            added.append(sid)
    else:
        raise RespecError(
            "B→A reward requires branch 'two_standard' or "
            "'two_unique_plus_one_standard'."
        )
    return added


def apply_allocation_effect(state: RebuiltState, allocation: CharacterXPAllocation) -> None:
    """Mutate in-memory state by replaying one active allocation."""
    meta = allocation.metadata or {}
    cost = int(allocation.xp_cost or 0)
    state.total_xp_spent += cost
    atype = allocation.allocation_type

    if atype == "LEVEL_UP_STAT":
        stat = _normalize_stand_stat(meta.get("stand_stat"))
        old = state.coin_stats.get(stat, "D")
        new_grade = _bump_grade(old)
        state.coin_stats[stat] = new_grade
        state.stand_coin_points_gained += 1
        if meta.get("b_to_a_reward") and not meta.get("reward_pending"):
            reward = meta.get("reward")
            if not reward:
                if meta.get("reward_branch") == "two_standard":
                    reward = {
                        "branch": "two_standard",
                        "standard_ability_ids": list(
                            meta.get("added_standard_ability_ids") or []
                        ),
                    }
                elif meta.get("reward_branch") in (
                    "two_unique_plus_one_standard",
                    "custom2plus1standard",
                ):
                    uniques = meta.get("unique_abilities") or []
                    stds = list(meta.get("added_standard_ability_ids") or [])
                    reward = {
                        "branch": "two_unique_plus_one_standard",
                        "unique_abilities": uniques,
                        "standard_ability_id": stds[0] if stds else None,
                    }
            if reward and reward.get("branch"):
                try:
                    _apply_b_to_a_to_state(state, allocation.id, reward)
                except RespecError:
                    for sid in meta.get("added_standard_ability_ids") or []:
                        sid = int(sid)
                        if sid not in state.standard_ability_ids:
                            state.standard_ability_ids.append(sid)

    elif atype == "MINOR_ADVANCE":
        action = _normalize_action(meta.get("action"))
        _bump_dot_state(state, action, 1)
        state.action_dice_gained += 1

    elif atype == "LEVEL_UP_DOTS":
        actions = meta.get("actions") or []
        for raw in actions:
            _bump_dot_state(state, _normalize_action(raw), 1)
        state.action_dice_gained += len(actions)

    elif atype == "BUY_HP":
        state.bonus_hp_from_xp += 1

    elif atype == "LEVEL_UP_HERITAGE":
        state.heritage_points_gained += 1

    elif atype == "LEVEL_UP_PLAYBOOK_ABILITY":
        state.playbook_ability_slots += 1
        picked = meta.get("picked") or {}
        kind = str(picked.get("kind") or "").lower()
        aid = picked.get("id")
        if aid is not None:
            aid = int(aid)
            if kind == "spin" and aid not in state.spin_ability_ids:
                state.spin_ability_ids.append(aid)
            elif kind == "hamon" and aid not in state.hamon_ability_ids:
                state.hamon_ability_ids.append(aid)

    elif atype == "LEVEL_UP_ACQUIRE_STAND":
        state.acquired_stand = True
        for f in STAND_STAT_FIELDS:
            state.coin_stats[f] = "D"

    elif atype == "UNLOCK_SECOND_PLAYBOOK":
        # Legacy grandfathered rows — no sheet fold effect beyond spend.
        pass


def rebuild_from_allocations(
    character: Character, *, allocations=None
) -> RebuiltState:
    """Replay active allocations onto chargen_baseline. Does not save."""
    baseline = character.chargen_baseline
    if not isinstance(baseline, dict) or baseline.get("action_dots") is None:
        baseline = capture_chargen_baseline(character)
    state = _state_from_baseline(baseline, character)
    if allocations is None:
        allocations = list(
            CharacterXPAllocation.objects.filter(
                character=character, undone_at__isnull=True
            ).order_by("created_at", "id")
        )
    else:
        allocations = sorted(
            [a for a in allocations if not a.undone_at],
            key=lambda a: (a.created_at, a.id),
        )
    for alloc in allocations:
        apply_allocation_effect(state, alloc)
    return state


def live_state_from_character(character: Character) -> dict:
    grades = _get_stand_grades(character)
    return {
        "action_dots": dict(character.action_dots or {}),
        "coin_stats": {f: grades.get(f, "D") for f in STAND_STAT_FIELDS},
        "standard_ability_ids": sorted(
            character.standard_abilities.values_list("id", flat=True)
        ),
        "spin_ability_ids": sorted(
            character.spin_abilities.values_list("spin_ability_id", flat=True)
        ),
        "hamon_ability_ids": sorted(
            character.hamon_abilities.values_list("hamon_ability_id", flat=True)
        ),
        "bonus_hp_from_xp": int(character.bonus_hp_from_xp or 0),
        "stand_coin_points_gained": int(character.stand_coin_points_gained or 0),
        "action_dice_gained": int(character.action_dice_gained or 0),
        "heritage_points_gained": int(character.heritage_points_gained or 0),
        "total_xp_spent": int(character.total_xp_spent or 0),
        "advancement_ability_grants": list(character.advancement_ability_grants or []),
    }


def _normalize_compare_state(d: dict) -> dict:
    return {
        "action_dots": {k: int(v or 0) for k, v in (d.get("action_dots") or {}).items()},
        "coin_stats": {
            f: str((d.get("coin_stats") or {}).get(f, "D")).upper()[:1]
            for f in STAND_STAT_FIELDS
        },
        "standard_ability_ids": sorted(int(x) for x in (d.get("standard_ability_ids") or [])),
        "spin_ability_ids": sorted(int(x) for x in (d.get("spin_ability_ids") or [])),
        "hamon_ability_ids": sorted(int(x) for x in (d.get("hamon_ability_ids") or [])),
        "bonus_hp_from_xp": int(d.get("bonus_hp_from_xp") or 0),
        "stand_coin_points_gained": int(d.get("stand_coin_points_gained") or 0),
        "action_dice_gained": int(d.get("action_dice_gained") or 0),
        "heritage_points_gained": int(d.get("heritage_points_gained") or 0),
        "total_xp_spent": int(d.get("total_xp_spent") or 0),
    }


def diff_fold_vs_live(character: Character) -> dict:
    """Return {field: {fold, live}} for mismatches; empty if reconciled."""
    rebuilt = rebuild_from_allocations(character)
    fold = _normalize_compare_state(rebuilt.to_dict())
    live = _normalize_compare_state(live_state_from_character(character))
    diffs = {}
    for key in fold:
        if fold[key] != live[key]:
            diffs[key] = {"fold": fold[key], "live": live[key]}
    return diffs


def verify_character_ledger(character: Character) -> tuple[bool, dict]:
    """Check fold vs live; update ledger_reconcile_ok."""
    if not character.chargen_baseline:
        ensure_chargen_baseline(character)
        character.refresh_from_db()
    diffs = diff_fold_vs_live(character)
    ok = not diffs
    if character.ledger_reconcile_ok != ok:
        character.ledger_reconcile_ok = ok
        character.save(update_fields=["ledger_reconcile_ok"])
    return ok, diffs


def validate_final_state(character: Character, state: RebuiltState) -> None:
    """Final-state validators for a respec draft."""
    # Stand floor: at least one grade ≥ D
    if any(state.coin_stats.get(f) for f in STAND_STAT_FIELDS):
        if not any(_grade_index(state.coin_stats.get(f, "F")) >= 1 for f in STAND_STAT_FIELDS):
            raise RespecError("At least one Stand Coin stat must stay D or higher.")

    for action, dots in (state.action_dots or {}).items():
        d = int(dots or 0)
        if d < 0 or d > 4:
            raise RespecError(f"Action {action} dots must be 0–4.")

    # Depth / playbook slot budget for Spin+Hamon non-foundation
    nf_spin = 0
    nf_hamon = 0
    if state.spin_ability_ids:
        for sa in SpinAbility.objects.filter(id__in=state.spin_ability_ids):
            if getattr(sa, "spin_type", None) != "FOUNDATION":
                nf_spin += 1
    if state.hamon_ability_ids:
        for ha in HamonAbility.objects.filter(id__in=state.hamon_ability_ids):
            if getattr(ha, "hamon_type", None) != "FOUNDATION":
                nf_hamon += 1
    used = nf_spin + nf_hamon
    # Baseline may already include one free L1 non-foundation pick.
    baseline = character.chargen_baseline or {}
    base_spin = set(int(x) for x in (baseline.get("spin_ability_ids") or []))
    base_hamon = set(int(x) for x in (baseline.get("hamon_ability_ids") or []))
    base_nf = 0
    if base_spin:
        for sa in SpinAbility.objects.filter(id__in=base_spin):
            if getattr(sa, "spin_type", None) != "FOUNDATION":
                base_nf += 1
    if base_hamon:
        for ha in HamonAbility.objects.filter(id__in=base_hamon):
            if getattr(ha, "hamon_type", None) != "FOUNDATION":
                base_nf += 1
    # slots = 1 free + one per LEVEL_UP_PLAYBOOK_ABILITY; baseline free picks count against free slot
    max_nf = max(state.playbook_ability_slots, base_nf)
    # playbook_ability_slots already starts at 1 and increments per advance.
    if used > state.playbook_ability_slots and used > base_nf:
        # Allow baseline non-foundation count without advances.
        advances = state.playbook_ability_slots - 1
        if used > base_nf + advances:
            raise RespecError(
                f"Too many non-foundation playbook abilities ({used}); "
                f"budget is {state.playbook_ability_slots} "
                f"(1 free + {advances} playbook advance(s))."
            )

    # Heritage HP budget
    heritage = getattr(character, "heritage", None)
    if heritage is not None:
        benefits = list(character.selected_benefits.all())
        detriments = list(character.selected_detriments.all())
        base_hp = int(heritage.base_hp or 0) + int(state.bonus_hp_from_xp or 0)
        gain = sum(d.hp_value for d in detriments if not d.required)
        cost = sum(b.hp_cost for b in benefits if not b.required)
        if base_hp + gain < cost:
            raise RespecError(
                f"HP budget exceeded after respec "
                f"(base {base_hp} + detriments {gain} < benefits {cost})."
            )

    # Pending B→A rewards must not remain for A-grade stats without reward data
    for f in STAND_STAT_FIELDS:
        if state.coin_stats.get(f) == "A":
            # Soft check — reward_pending on active allocs handled at commit time
            pass


def write_rebuilt_state_to_character(character: Character, state: RebuiltState) -> None:
    """Persist rebuilt derived fields onto the character (M2M + scalars)."""
    from characters.services.xp_allocation import _set_stand_grade

    character.action_dots = dict(state.action_dots)
    for f, grade in state.coin_stats.items():
        if f in STAND_STAT_FIELDS:
            _set_stand_grade(character, f, grade)
    character.bonus_hp_from_xp = int(state.bonus_hp_from_xp)
    character.stand_coin_points_gained = int(state.stand_coin_points_gained)
    character.action_dice_gained = int(state.action_dice_gained)
    character.heritage_points_gained = int(state.heritage_points_gained)
    character.total_xp_spent = int(state.total_xp_spent)
    character.advancement_ability_grants = list(state.advancement_ability_grants or [])
    character.extra_custom_abilities = list(state.extra_custom_abilities or [])
    character.save()
    character.standard_abilities.set(state.standard_ability_ids)

    # Sync spin / hamon junction tables
    want_spin = set(int(x) for x in state.spin_ability_ids)
    want_hamon = set(int(x) for x in state.hamon_ability_ids)
    baseline = character.chargen_baseline or {}
    base_spin = set(int(x) for x in (baseline.get("spin_ability_ids") or []))
    base_hamon = set(int(x) for x in (baseline.get("hamon_ability_ids") or []))

    CharacterSpinAbility.objects.filter(character=character).exclude(
        spin_ability_id__in=want_spin
    ).delete()
    for sid in want_spin:
        CharacterSpinAbility.objects.get_or_create(
            character=character,
            spin_ability_id=sid,
            defaults={"acquired_at_creation": sid in base_spin},
        )
    CharacterHamonAbility.objects.filter(character=character).exclude(
        hamon_ability_id__in=want_hamon
    ).delete()
    for hid in want_hamon:
        CharacterHamonAbility.objects.get_or_create(
            character=character,
            hamon_ability_id=hid,
            defaults={"acquired_at_creation": hid in base_hamon},
        )


def _cost_for_added(item: dict) -> int:
    t = str(item.get("type") or item.get("allocation_type") or "").upper()
    if t in (
        "LEVEL_UP_STAT",
        "LEVEL_UP_DOTS",
        "LEVEL_UP_HERITAGE",
        "LEVEL_UP_PLAYBOOK_ABILITY",
        "LEVEL_UP_ACQUIRE_STAND",
    ):
        return LEVEL_UP_COST
    if t in ("MINOR_ADVANCE", "BUY_HP"):
        return MINOR_ADVANCE_COST
    raise RespecError(f"Unknown addition type: {t}")


def _mint_respec_allocation(
    character: Character, item: dict, *, user=None
) -> CharacterXPAllocation:
    """Create an allocation funded from unallocated_xp (respec path)."""
    from characters.services.xp_allocation import _snapshot

    atype = str(item.get("type") or item.get("allocation_type") or "").upper()
    cost = _cost_for_added(item)
    pool = int(character.unallocated_xp or 0)
    if pool < cost:
        raise RespecError(
            f"Not enough Available XP for {atype} (have {pool}, need {cost})."
        )
    character.unallocated_xp = pool - cost

    before = _snapshot(character)
    meta: dict[str, Any] = {
        "from_respec": True,
        "from_pool": True,
        "from_pending": False,
    }
    track = "playbook"
    if atype == "LEVEL_UP_STAT":
        stat = _normalize_stand_stat(item.get("stand_stat"))
        grades = _get_stand_grades(character)
        old_grade = grades.get(stat, "D")
        new_grade = _bump_grade(old_grade)
        meta.update(
            {
                "stand_stat": stat,
                "old_grade": old_grade,
                "new_grade": new_grade,
                "choice": "stat",
                "b_to_a_reward": old_grade == "B" and new_grade == "A",
            }
        )
        reward = item.get("reward")
        if meta["b_to_a_reward"]:
            if not reward:
                raise RespecError("B→A Stand Coin advance requires a reward choice.")
            meta["reward"] = reward
            meta["reward_branch"] = reward.get("branch")
            meta["reward_pending"] = False
            if reward.get("branch") == "two_standard":
                meta["added_standard_ability_ids"] = list(
                    reward.get("standard_ability_ids") or []
                )
            else:
                meta["unique_abilities"] = reward.get("unique_abilities") or []
                meta["added_standard_ability_ids"] = [
                    int(reward["standard_ability_id"])
                ] if reward.get("standard_ability_id") is not None else []
        track = "playbook"
    elif atype == "MINOR_ADVANCE":
        action = _normalize_action(item.get("action"))
        track = _normalize_track(item.get("xp_track") or "insight")
        if track not in ("insight", "prowess", "resolve"):
            raise RespecError("Minor advance must use insight, prowess, or resolve.")
        meta["action"] = action
        meta["xp_track"] = track
    elif atype == "LEVEL_UP_DOTS":
        actions = [_normalize_action(a) for a in (item.get("actions") or [])]
        if len(actions) != 2:
            raise RespecError("LEVEL_UP_DOTS requires exactly 2 actions.")
        meta["actions"] = actions
        meta["choice"] = "dots"
        track = "playbook"
    elif atype == "BUY_HP":
        track = "heritage"
        meta["xp_track"] = track
    elif atype == "LEVEL_UP_PLAYBOOK_ABILITY":
        track = "playbook"
        meta["choice"] = "playbook_ability"
        picked = item.get("picked") or {}
        if not picked.get("id") or not picked.get("kind"):
            raise RespecError(
                "Playbook ability advance requires picked {kind, id}."
            )
        meta["picked"] = {
            "kind": str(picked["kind"]).lower(),
            "id": int(picked["id"]),
            "name": str(picked.get("name") or ""),
        }
    elif atype == "LEVEL_UP_HERITAGE":
        track = "playbook"
        meta["choice"] = "heritage"
    elif atype == "LEVEL_UP_ACQUIRE_STAND":
        track = "playbook"
        meta["choice"] = "acquire_stand"
    else:
        raise RespecError(f"Cannot mint allocation type {atype} via respec.")

    allocation = CharacterXPAllocation.objects.create(
        character=character,
        allocation_type=atype,
        xp_track=track,
        xp_cost=cost,
        payload_before=before,
        payload_after={},
        metadata=meta,
    )
    return allocation


@transaction.atomic
def commit_respec(
    character: Character,
    *,
    draft: dict,
    commit_token: str,
    user=None,
    allow_acquire_stand_drop: bool = False,
) -> dict:
    """
    Diff-based respec commit.

    Refunds dropped allocation costs to unallocated_xp, mints additions from
    that pool, then rebuilds derived sheet state from the ledger.
    """
    token = str(commit_token or "").strip()
    if not token:
        raise RespecError("commit_token is required.")
    if len(token) > 64:
        raise RespecError("commit_token is too long.")

    character = (
        Character.objects.select_for_update()
        .select_related("heritage", "stand", "campaign")
        .get(pk=character.pk)
    )

    if character.last_respec_commit_token == token:
        return {
            "idempotent": True,
            "character": character,
            "allocations": list(list_allocations(character, include_undone=True)),
            "net_xp": 0,
            "summary": "Already applied (same commit_token).",
        }

    if not character.ledger_reconcile_ok:
        raise RespecError(
            "This character's XP ledger does not reconcile with the sheet. "
            "Ask a GM to run verify_allocation_ledger / repair before Respec."
        )

    ensure_chargen_baseline(character)
    character.refresh_from_db()

    dropped_ids = [int(x) for x in (draft.get("dropped_allocation_ids") or [])]
    added = list(draft.get("added") or [])

    active = {
        a.id: a
        for a in CharacterXPAllocation.objects.select_for_update().filter(
            character=character, undone_at__isnull=True
        )
    }

    dropped = []
    for aid in dropped_ids:
        alloc = active.get(aid)
        if alloc is None:
            raise RespecError(f"Allocation {aid} is not an active spend on this character.")
        if (
            alloc.allocation_type == "LEVEL_UP_ACQUIRE_STAND"
            and not allow_acquire_stand_drop
        ):
            raise RespecError(
                "Dropping Acquire Stand is not allowed in Respec (phase 1)."
            )
        dropped.append(alloc)

    refund = sum(int(a.xp_cost or 0) for a in dropped)
    spend = sum(_cost_for_added(item) for item in added)
    net = refund - spend

    # Mark drops
    now = timezone.now()
    for alloc in dropped:
        meta = dict(alloc.metadata or {})
        meta["reversal"] = True
        meta["respec_commit_token"] = token
        alloc.metadata = meta
        alloc.undone_at = now
        alloc.undone_by = user
        alloc.save(update_fields=["metadata", "undone_at", "undone_by"])

    character.unallocated_xp = int(character.unallocated_xp or 0) + refund
    character.save(update_fields=["unallocated_xp"])

    minted = []
    for item in added:
        minted.append(_mint_respec_allocation(character, item, user=user))

    # Rebuild from remaining + minted
    remaining = list(
        CharacterXPAllocation.objects.filter(
            character=character, undone_at__isnull=True
        ).order_by("created_at", "id")
    )
    state = rebuild_from_allocations(character, allocations=remaining)
    validate_final_state(character, state)
    write_rebuilt_state_to_character(character, state)

    # Sync total_xp_spent from ledger after write
    ledger_total = (
        CharacterXPAllocation.objects.filter(
            character=character, undone_at__isnull=True
        ).aggregate(total=Sum("xp_cost"))["total"]
        or 0
    )
    character.total_xp_spent = int(ledger_total)
    character.last_respec_commit_token = token
    character.ledger_reconcile_ok = True
    character.save(
        update_fields=[
            "total_xp_spent",
            "last_respec_commit_token",
            "ledger_reconcile_ok",
            "unallocated_xp",
        ]
    )

    # Update payload_after on minted rows
    from characters.services.xp_allocation import _snapshot

    after = _snapshot(character)
    for alloc in minted:
        alloc.payload_after = after
        alloc.save(update_fields=["payload_after"])

    character.refresh_from_db()
    summary_parts = []
    if dropped:
        summary_parts.append(f"reversed {len(dropped)} spend(s)")
    if minted:
        summary_parts.append(f"added {len(minted)} spend(s)")
    summary_parts.append(f"net {net:+d} Available XP")

    return {
        "idempotent": False,
        "character": character,
        "allocations": list(list_allocations(character, include_undone=True)),
        "net_xp": net,
        "refunded": refund,
        "spent": spend,
        "dropped_ids": [a.id for a in dropped],
        "minted_ids": [a.id for a in minted],
        "summary": "; ".join(summary_parts),
        "rebuilt": state.to_dict(),
    }


def backfill_playbook_ability_picks(character: Character) -> int:
    """
    Best-effort: attach non-foundation Spin/Hamon picks to LEVEL_UP_PLAYBOOK_ABILITY
    rows missing metadata.picked. Returns number of rows updated.
    """
    baseline = character.chargen_baseline or {}
    base_spin = set(int(x) for x in (baseline.get("spin_ability_ids") or []))
    base_hamon = set(int(x) for x in (baseline.get("hamon_ability_ids") or []))

    open_slots = list(
        CharacterXPAllocation.objects.filter(
            character=character,
            allocation_type="LEVEL_UP_PLAYBOOK_ABILITY",
            undone_at__isnull=True,
        ).order_by("created_at", "id")
    )
    unpicked = [
        a
        for a in open_slots
        if not (a.metadata or {}).get("picked")
    ]
    if not unpicked:
        return 0

    candidates = []
    for link in character.spin_abilities.select_related("spin_ability").order_by("id"):
        sa = link.spin_ability
        if link.spin_ability_id in base_spin:
            continue
        if getattr(sa, "spin_type", None) == "FOUNDATION":
            continue
        candidates.append(("spin", sa.id, sa.name))
    for link in character.hamon_abilities.select_related("hamon_ability").order_by("id"):
        ha = link.hamon_ability
        if link.hamon_ability_id in base_hamon:
            continue
        if getattr(ha, "hamon_type", None) == "FOUNDATION":
            continue
        candidates.append(("hamon", ha.id, ha.name))

    updated = 0
    for alloc, cand in zip(unpicked, candidates):
        kind, aid, name = cand
        meta = dict(alloc.metadata or {})
        meta["picked"] = {"kind": kind, "id": int(aid), "name": str(name or "")}
        meta["picked_backfilled"] = True
        alloc.metadata = meta
        alloc.save(update_fields=["metadata"])
        updated += 1
    return updated
