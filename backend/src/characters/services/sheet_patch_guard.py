"""Reject server-authoritative character fields on generic sheet PATCH/PUT.

Allocation endpoints (apply-level-up, undo/redo, gm-force-*, pool allocate, etc.)
own XP counters, stand coin grades after chargen, and related advancement state.
"""

from __future__ import annotations

import logging
from typing import Any

from characters.models import CharacterXPAllocation

logger = logging.getLogger(__name__)

STAND_GRADE_FIELDS = frozenset(
    {
        "power",
        "speed",
        "range",
        "durability",
        "precision",
        "development",
    }
)

# Never writable via generic sheet update once the character row exists.
ALWAYS_PATCH_REJECTED_FIELDS = frozenset(
    {
        "xp_clocks",
        "unallocated_xp",
        "total_xp_spent",
        "stand_coin_points_gained",
        "heritage_points_gained",
        "advancement_ability_grants",
        "coin_stats",
        "bonus_hp_from_xp",
        "secondary_playbook",
    }
)

# Writable only during chargen (before any CharacterXPAllocation row exists).
CHARGEN_ONLY_PATCH_FIELDS = frozenset(
    {
        "level",
        "action_dice_gained",
    }
)


def character_in_chargen(character) -> bool:
    """True while no XP allocation has ever been recorded for this character."""
    if character is None or not character.pk:
        return True
    return not CharacterXPAllocation.objects.filter(character_id=character.pk).exists()


def _stand_grade_subset(stand_data: dict | None) -> dict | None:
    if not isinstance(stand_data, dict):
        return None
    grades = {k: stand_data[k] for k in stand_data if k in STAND_GRADE_FIELDS}
    return grades or None


def collect_rejected_sheet_patch_fields(character, raw_data: dict | None) -> dict[str, Any]:
    """Return ``{field: client_value}`` for authoritative keys present in ``raw_data``."""
    rejected: dict[str, Any] = {}
    if not isinstance(raw_data, dict):
        return rejected

    in_chargen = character_in_chargen(character)

    for field in ALWAYS_PATCH_REJECTED_FIELDS:
        if field in raw_data:
            rejected[field] = raw_data[field]

    if not in_chargen:
        for field in CHARGEN_ONLY_PATCH_FIELDS:
            if field in raw_data:
                rejected[field] = raw_data[field]
        stand_grades = _stand_grade_subset(raw_data.get("stand"))
        if stand_grades:
            rejected["stand"] = stand_grades

    return rejected


def strip_authoritative_patch_fields(validated_data: dict, *, in_chargen: bool) -> None:
    """Remove server-owned keys from ``validated_data`` (mutates in place)."""
    for field in ALWAYS_PATCH_REJECTED_FIELDS:
        validated_data.pop(field, None)
    if not in_chargen:
        for field in CHARGEN_ONLY_PATCH_FIELDS:
            validated_data.pop(field, None)


def sheet_patch_guard_enabled(serializer) -> bool:
    """When False, serializer update skips authoritative-field rejection (dedicated XP APIs)."""
    return not bool(serializer.context.get("skip_sheet_patch_guard"))


def payload_without_stand_grades(stand_data, coin_stats):
    """Strip grade keys from nested stand / coin_stats dicts (identity fields kept)."""
    stand_out = None
    if isinstance(stand_data, dict):
        stand_out = {
            k: v for k, v in stand_data.items() if k not in STAND_GRADE_FIELDS
        }
    coin_out = None
    if isinstance(coin_stats, dict):
        grade_keys = set(STAND_GRADE_FIELDS) | {f.upper() for f in STAND_GRADE_FIELDS}
        coin_out = {k: v for k, v in coin_stats.items() if k not in grade_keys}
    return stand_out, coin_out


def log_rejected_sheet_patch_fields(character, rejected: dict[str, Any]) -> None:
    if not rejected:
        return
    logger.warning(
        "Rejected server-authoritative fields on character sheet PATCH "
        "(character_id=%s keys=%s)",
        getattr(character, "pk", None),
        sorted(rejected.keys()),
    )
