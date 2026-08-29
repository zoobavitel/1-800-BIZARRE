"""Map Character model instances to PDF AcroForm field values."""

from __future__ import annotations

from typing import Any

from characters.models import Character, Trauma
from characters.roll_helpers import max_stress_slots_for_character
from characters.services.playbook_xp_archetype import (
    resolve_playbook_xp_archetype_labels,
)

from .field_maps import (
    ACTION_KEYS,
    MAX_CLOCK_SEGMENTS,
    MAX_COIN_BOXES,
    MAX_HEALING_SEGMENTS,
    MAX_STASH_SLOTS,
    SPIN_HAMON_ARMOR_MAX,
    STAND_PATH_ARMOR_BY_GRADE,
    STAND_STAT_KEYS,
    TRAUMA_KEYS,
    XP_TRACK_KEYS,
    xp_track_max_segments,
)

CHECKBOX_ON = "/Yes"
CHECKBOX_OFF = "/Off"

_PLAYBOOK_LABELS = {
    "STAND": "Stand",
    "HAMON": "Hamon",
    "SPIN": "Spin",
}


def _checkbox(value: bool) -> str:
    return CHECKBOX_ON if value else CHECKBOX_OFF


def _playbook_label(raw: str | None) -> str:
    if not raw:
        return ""
    key = str(raw).strip().upper()
    return _PLAYBOOK_LABELS.get(key, str(raw).replace("_", " ").title())


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


def _ability_line(prefix: str, name: str, desc: str = "") -> str:
    base = f"{prefix} {name}".strip() if prefix else name
    desc = (desc or "").strip()
    return f"{base}: {desc}" if desc else base


def _format_abilities(character: Character) -> tuple[str, str]:
    lines: list[str] = []
    for ability in character.standard_abilities.all():
        desc = (ability.description or "").strip()
        lines.append(_ability_line("[Standard]", ability.name, desc))
    stand = getattr(character, "stand", None)
    if stand is not None:
        for sa in stand.abilities.all():
            lines.append(_ability_line("[Stand unique]", sa.name, sa.description or ""))
    for entry in character.hamon_abilities.select_related("hamon_ability").all():
        ha = entry.hamon_ability
        path = ha.get_hamon_type_display() if ha else "Hamon"
        level = int(getattr(ha, "required_a_count", 0) or 0)
        tag = f"[Hamon · {path}"
        if level > 0:
            tag += f" · Level {level}"
        tag += "]"
        lines.append(_ability_line(tag, ha.name, ha.description or ""))
    for entry in character.spin_abilities.select_related("spin_ability").all():
        sa = entry.spin_ability
        path = sa.get_spin_type_display() if sa else "Spin"
        level = int(getattr(sa, "required_a_count", 0) or 0)
        tag = f"[Spin · {path}"
        if level > 0:
            tag += f" · Level {level}"
        tag += "]"
        lines.append(_ability_line(tag, sa.name, sa.description or ""))
    if character.custom_ability_description:
        lines.append(f"[Custom] {character.custom_ability_description}")
    extra = character.extra_custom_abilities or []
    if isinstance(extra, list):
        for item in extra:
            if isinstance(item, dict):
                name = item.get("name") or "Custom"
                desc = item.get("description") or ""
                lines.append(_ability_line("[Custom]", str(name), str(desc)))
            elif item:
                lines.append(f"[Custom] {item}")
    core = "\n".join(lines[:8])
    overflow = "\n".join(lines[8:])
    return core, overflow


def _format_scalar_line(item: Any) -> str:
    if item is None or item is False:
        return ""
    if isinstance(item, dict):
        name = (
            item.get("name")
            or item.get("item")
            or item.get("label")
            or item.get("title")
            or ""
        )
        qty = item.get("quantity") or item.get("qty") or item.get("count")
        note = (
            item.get("notes")
            or item.get("description")
            or item.get("note")
            or item.get("detail")
            or ""
        )
        load = item.get("load") or item.get("load_cost")
        line = str(name).strip()
        if qty not in (None, "", 1, "1"):
            line += f" ×{qty}"
        if load not in (None, ""):
            line += f" (load {load})"
        if note:
            line += f" — {note}"
        if not line:
            # Fall back to readable key/value pairs instead of raw JSON dump
            parts = [
                f"{k}: {v}"
                for k, v in item.items()
                if v not in (None, "", [], {})
            ]
            line = "; ".join(parts)
        return line
    return str(item).strip()


def _format_inventory(inventory: Any) -> str:
    if not inventory:
        return ""
    if isinstance(inventory, list):
        parts = []
        for item in inventory:
            line = _format_scalar_line(item)
            if line:
                parts.append(line)
        return "\n".join(parts)
    if isinstance(inventory, dict):
        # Common shapes: {items: [...]}, {loadout: [...], stash: [...]}, or flat map
        if "items" in inventory and isinstance(inventory.get("items"), list):
            return _format_inventory(inventory["items"])
        sections: list[str] = []
        for key, val in inventory.items():
            label = str(key).replace("_", " ").title()
            if isinstance(val, list):
                body = _format_inventory(val)
                if body:
                    sections.append(f"{label}:\n{body}")
            elif isinstance(val, dict):
                nested = _format_inventory(val)
                if nested:
                    sections.append(f"{label}:\n{nested}")
            elif val not in (None, "", [], {}):
                sections.append(f"{label}: {val}")
        return "\n\n".join(sections)
    return str(inventory)


def _format_mapping(value: Any) -> str:
    """Human-readable dict/list for reputation / faction status."""
    if not value:
        return ""
    if isinstance(value, dict):
        lines = []
        for k, v in value.items():
            if v in (None, "", [], {}):
                continue
            lines.append(f"{k}: {v}")
        return "\n".join(lines)
    if isinstance(value, list):
        parts = []
        for item in value:
            line = _format_scalar_line(item)
            if line:
                parts.append(line)
        return "\n".join(parts)
    return str(value)


def _heritage_picks(character: Character) -> str:
    benefits = []
    for b in character.selected_benefits.all():
        desc = (b.description or "").strip()
        benefits.append(f"{b.name}: {desc}" if desc else b.name)
    detriments = []
    for d in character.selected_detriments.all():
        desc = (d.description or "").strip()
        detriments.append(f"{d.name}: {desc}" if desc else d.name)
    parts = []
    if benefits:
        parts.append("Benefits:\n" + "\n".join(f"• {x}" for x in benefits))
    if detriments:
        parts.append("Detriments:\n" + "\n".join(f"• {x}" for x in detriments))
    return "\n\n".join(parts)


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


def _stand_display_name(character: Character) -> str:
    stand = getattr(character, "stand", None)
    if stand is not None and (stand.name or "").strip():
        return stand.name.strip()
    return (character.stand_name or "").strip()


def _stand_type_label(character: Character) -> str:
    stand = getattr(character, "stand", None)
    if stand is None:
        return ""
    try:
        return stand.get_type_display() or ""
    except Exception:
        return str(getattr(stand, "type", "") or "").replace("_", " ").title()


def _stand_forms_label(character: Character) -> str:
    stand = getattr(character, "stand", None)
    if stand is None:
        return ""
    forms = getattr(stand, "forms", None) or []
    if isinstance(forms, list) and forms:
        return ", ".join(str(f).strip() for f in forms if str(f).strip())
    form = (getattr(stand, "form", None) or "").strip()
    return form


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
            "stand__abilities",
        )
        .get(pk=character.pk)
    )

    values: dict[str, str] = {}
    values["pc_name"] = character.true_name or ""
    values["pc_alias"] = character.alias or ""
    values["pc_stand_name"] = _stand_display_name(character)
    crew_name = ""
    if character.crew_id and character.crew:
        crew_name = character.crew.name or ""
    elif character.personal_crew_name:
        crew_name = character.personal_crew_name
    values["pc_crew"] = crew_name
    values["pc_look"] = character.appearance or ""
    values["pc_background"] = character.background_note or ""
    values["pc_heritage"] = character.heritage.name if character.heritage_id else ""
    vice_name = character.vice.name if character.vice_id else ""
    vice_details = (character.vice_details or "").strip()
    values["pc_vice"] = (
        f"{vice_name} — {vice_details}" if vice_name and vice_details else vice_name
    )
    values["pc_vice_details"] = vice_details
    values["pc_campaign"] = character.campaign.name if character.campaign_id else ""
    values["pc_playbook"] = _playbook_label(character.playbook)
    values["pc_secondary_playbook"] = _playbook_label(character.secondary_playbook)
    values["pc_level"] = str(max(0, int(character.level or 0)))
    values["pc_playbook_archetypes"] = resolve_playbook_xp_archetype_labels(character)
    values["pc_close_friend"] = character.close_friend or ""
    values["pc_rival"] = character.rival or ""
    values["pc_loadout"] = str(max(0, int(character.loadout or 0)))

    values["pc_stand_type"] = _stand_type_label(character)
    stand = getattr(character, "stand", None)
    values["pc_stand_type_custom"] = (
        (stand.type_custom or "").strip() if stand is not None else ""
    )
    values["pc_stand_forms"] = _stand_forms_label(character)
    values["pc_stand_consciousness"] = (
        str(getattr(stand, "consciousness_level", "") or "").upper()
        if stand is not None
        else ""
    )

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
        max(1, int(character.healing_clock_segments or 4)),
    )
    for i in range(healing_max):
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

    spin_used = max(0, int(character.spin_armor_used or 0))
    hamon_used = max(0, int(character.hamon_armor_used or 0))
    pb = str(character.playbook or "").upper()
    sec = str(character.secondary_playbook or "").upper()
    show_spin = pb == "SPIN" or sec == "SPIN"
    show_hamon = pb == "HAMON" or sec == "HAMON"
    values["pc_armor_spin"] = (
        f"{spin_used}/{SPIN_HAMON_ARMOR_MAX}" if show_spin else ""
    )
    values["pc_armor_hamon"] = (
        f"{hamon_used}/{SPIN_HAMON_ARMOR_MAX}" if show_hamon else ""
    )

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
    values["pc_reputation"] = _format_mapping(
        character.reputation_status
    ) or _format_mapping(character.faction_reputation)

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
