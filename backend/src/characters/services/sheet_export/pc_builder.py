"""Map Character model instances to PDF AcroForm field values."""

from __future__ import annotations

import json
from typing import Any

from characters.models import Character, Trauma
from characters.roll_helpers import max_stress_slots_for_character

from .field_maps import (
    ACTION_KEYS,
    MAX_CLOCK_SEGMENTS,
    MAX_COIN_BOXES,
    MAX_HEALING_SEGMENTS,
    MAX_STASH_SLOTS,
    MAX_XP_PER_TRACK,
    MAX_XP_PLAYBOOK_TRACK,
    STAND_PATH_ARMOR_BY_GRADE,
    STAND_STAT_KEYS,
    TRAUMA_KEYS,
    XP_TRACK_KEYS,
    xp_track_max_segments,
)

CHECKBOX_ON = "/Yes"
CHECKBOX_OFF = "/Off"


def _checkbox(value: bool) -> str:
    return CHECKBOX_ON if value else CHECKBOX_OFF


def _stand_grade(character: Character, stat: str) -> str:
    stand = getattr(character, "stand", None)
    if stand is not None:
        grade = getattr(stand, stat, None)
        if grade:
            return str(grade).upper()
    coin = character.coin_stats or {}
    for key in (stat, stat.upper(), stat.capitalize()):
        if key in coin and coin[key]:
            return str(coin[key]).upper()
    return ""


def _action_dots(character: Character) -> dict[str, int]:
    raw = character.action_dots or {}
    if not raw:
        return {k: 0 for k in ACTION_KEYS}
    first = next(iter(raw.values()), None)
    if isinstance(first, dict):
        flat: dict[str, int] = {}
        for group in raw.values():
            if isinstance(group, dict):
                flat.update(group)
        raw = flat
    attune = raw.get("attune") or raw.get("bizarre") or 0
    return {
        "hunt": int(raw.get("hunt") or 0),
        "study": int(raw.get("study") or 0),
        "survey": int(raw.get("survey") or 0),
        "tinker": int(raw.get("tinker") or 0),
        "finesse": int(raw.get("finesse") or 0),
        "prowl": int(raw.get("prowl") or 0),
        "skirmish": int(raw.get("skirmish") or 0),
        "wreck": int(raw.get("wreck") or 0),
        "bizarre": int(attune),
        "command": int(raw.get("command") or 0),
        "consort": int(raw.get("consort") or 0),
        "sway": int(raw.get("sway") or 0),
    }


def _trauma_flags(character: Character) -> dict[str, bool]:
    flags = {k: False for k in TRAUMA_KEYS}
    raw = character.trauma or []
    pks: list[int] = []
    names: list[str] = []
    for item in raw:
        if isinstance(item, int) and item > 0:
            pks.append(item)
        elif isinstance(item, str):
            s = item.strip()
            if s.isdigit():
                pks.append(int(s))
            elif s:
                names.append(s.lower())
    for trauma in Trauma.objects.filter(pk__in=pks):
        key = trauma.name.strip().lower()
        if key in flags:
            flags[key] = True
    for name in names:
        if name in flags:
            flags[name] = True
    return flags


def _format_abilities(character: Character) -> tuple[str, str]:
    lines: list[str] = []
    for ability in character.standard_abilities.all():
        desc = (ability.description or "").strip()
        lines.append(f"{ability.name}: {desc}" if desc else ability.name)
    for entry in character.hamon_abilities.select_related("hamon_ability").all():
        ha = entry.hamon_ability
        desc = (ha.description or "").strip()
        lines.append(f"[Hamon] {ha.name}: {desc}" if desc else f"[Hamon] {ha.name}")
    for entry in character.spin_abilities.select_related("spin_ability").all():
        sa = entry.spin_ability
        desc = (sa.description or "").strip()
        lines.append(f"[Spin] {sa.name}: {desc}" if desc else f"[Spin] {sa.name}")
    if character.custom_ability_description:
        lines.append(f"Custom: {character.custom_ability_description}")
    extra = character.extra_custom_abilities or []
    if isinstance(extra, list):
        for item in extra:
            if isinstance(item, dict):
                name = item.get("name") or "Custom"
                desc = item.get("description") or ""
                lines.append(f"{name}: {desc}" if desc else name)
    core = "\n".join(lines[:8])
    overflow = "\n".join(lines[8:])
    return core, overflow


def _format_inventory(inventory: Any) -> str:
    if not inventory:
        return ""
    if isinstance(inventory, list):
        parts = []
        for item in inventory:
            if isinstance(item, dict):
                name = item.get("name") or item.get("item") or ""
                qty = item.get("quantity") or item.get("qty")
                note = item.get("notes") or item.get("description") or ""
                line = str(name).strip()
                if qty not in (None, "", 1, "1"):
                    line += f" x{qty}"
                if note:
                    line += f" — {note}"
                if line:
                    parts.append(line)
            elif item:
                parts.append(str(item))
        return "\n".join(parts)
    if isinstance(inventory, dict):
        return json.dumps(inventory, indent=2)
    return str(inventory)


def _heritage_picks(character: Character) -> str:
    benefits = [b.name for b in character.selected_benefits.all()]
    detriments = [d.name for d in character.selected_detriments.all()]
    parts = []
    if benefits:
        parts.append("Benefits: " + ", ".join(benefits))
    if detriments:
        parts.append("Detriments: " + ", ".join(detriments))
    return "\n".join(parts)


def _stash_slots(character: Character) -> list[bool]:
    if character.crew_id and character.crew is not None:
        slots = character.crew.stash_slots or []
    else:
        slots = character.stash_slots or []
    normalized = [bool(x) for x in slots]
    while len(normalized) < MAX_STASH_SLOTS:
        normalized.append(False)
    return normalized[:MAX_STASH_SLOTS]


def _stand_armor_max(character: Character) -> int:
    grade = _stand_grade(character, "durability")
    return STAND_PATH_ARMOR_BY_GRADE.get(grade, 0)


def build_pc_field_values(character: Character) -> dict[str, str]:
    """Return AcroForm field name -> value for a PC sheet export."""
    character = (
        Character.objects.select_related("campaign", "crew", "heritage", "vice", "stand")
        .prefetch_related(
            "standard_abilities",
            "hamon_abilities__hamon_ability",
            "spin_abilities__spin_ability",
            "selected_benefits",
            "selected_detriments",
            "progress_clocks",
        )
        .get(pk=character.pk)
    )

    values: dict[str, str] = {}
    values["pc_name"] = character.true_name or ""
    values["pc_stand_name"] = character.stand_name or ""
    crew_name = ""
    if character.crew_id and character.crew:
        crew_name = character.crew.name or ""
    elif character.personal_crew_name:
        crew_name = character.personal_crew_name
    values["pc_crew"] = crew_name
    values["pc_look"] = character.appearance or ""
    values["pc_background"] = character.background_note or ""
    values["pc_heritage"] = character.heritage.name if character.heritage_id else ""
    values["pc_vice"] = character.vice.name if character.vice_id else ""
    values["pc_campaign"] = character.campaign.name if character.campaign_id else ""
    values["pc_playbook"] = character.playbook or ""
    archetypes = character.playbook_xp_archetypes or []
    values["pc_playbook_archetypes"] = ", ".join(str(a) for a in archetypes)

    for stat in STAND_STAT_KEYS:
        values[f"pc_stand_{stat}"] = _stand_grade(character, stat)

    dots = _action_dots(character)
    for action in ACTION_KEYS:
        values[f"pc_action_{action}"] = str(dots.get(action, 0))

    stress = max(0, int(character.stress or 0))
    max_stress = max_stress_slots_for_character(character)
    for i in range(max_stress):
        values[f"pc_stress_{i}"] = _checkbox(i < min(stress, max_stress))

    trauma_flags = _trauma_flags(character)
    for key in TRAUMA_KEYS:
        values[f"pc_trauma_{key}"] = _checkbox(trauma_flags.get(key, False))

    harm_map = {
        "pc_harm_l4": character.harm_level4_name or "",
        "pc_harm_l3": character.harm_level3_name or "",
        "pc_harm_l2": character.harm_level2_name or "",
        "pc_harm_l2_slot2": character.harm_level2_slot2_name or "",
        "pc_harm_l1": character.harm_level1_name or "",
        "pc_harm_l1_slot2": character.harm_level1_slot2_name or "",
    }
    values.update(harm_map)

    healing_filled = max(0, int(character.healing_clock_filled or 0))
    healing_max = min(
        MAX_HEALING_SEGMENTS,
        max(1, int(character.healing_clock_segments or MAX_HEALING_SEGMENTS)),
    )
    for i in range(MAX_HEALING_SEGMENTS):
        values[f"pc_healing_{i}"] = _checkbox(i < min(healing_filled, healing_max))

    stand_used = max(0, int(character.stand_armor_used or 0))
    stand_max = _stand_armor_max(character)
    values["pc_armor_stand"] = f"{stand_used}/{stand_max}"

    phys_used = max(0, int(character.physical_armor_used or 0))
    phys_max = (
        max(0, min(6, int(character.physical_armor_bonus_charges or 0)))
        if character.has_physical_armor_item
        else 0
    )
    values["pc_armor_physical"] = f"{phys_used}/{phys_max}"

    coin = character.coin_boxes or [False] * MAX_COIN_BOXES
    for i in range(MAX_COIN_BOXES):
        values[f"pc_coin_{i}"] = _checkbox(bool(coin[i]) if i < len(coin) else False)

    stash = _stash_slots(character)
    for i in range(MAX_STASH_SLOTS):
        values[f"pc_stash_{i}"] = _checkbox(stash[i])

    xp = character.xp_clocks or {}
    for track in XP_TRACK_KEYS:
        max_segments = xp_track_max_segments(track)
        filled = max(0, min(max_segments, int(xp.get(track) or 0)))
        for i in range(max_segments):
            values[f"pc_xp_{track}_{i}"] = _checkbox(i < filled)

    values["pc_unallocated_xp"] = str(max(0, int(character.unallocated_xp or 0)))

    abilities_core, abilities_overflow = _format_abilities(character)
    values["pc_abilities"] = abilities_core
    values["pc_abilities_overflow"] = abilities_overflow
    values["pc_notes"] = character.background_note2 or ""
    values["pc_inventory"] = _format_inventory(character.inventory)
    values["pc_heritage_picks"] = _heritage_picks(character)

    clocks = list(character.progress_clocks.all().order_by("id")[:4])
    for idx in range(4):
        slot = idx + 1
        if idx < len(clocks):
            clock = clocks[idx]
            values[f"pc_clock_{slot}_name"] = clock.name or ""
            filled = max(0, int(clock.filled_segments or 0))
            segments = max(1, int(clock.max_segments or 4))
            for seg in range(MAX_CLOCK_SEGMENTS):
                values[f"pc_clock_{slot}_seg_{seg}"] = _checkbox(
                    seg < min(filled, segments)
                )
        else:
            values[f"pc_clock_{slot}_name"] = ""
            for seg in range(MAX_CLOCK_SEGMENTS):
                values[f"pc_clock_{slot}_seg_{seg}"] = _checkbox(False)

    return values
