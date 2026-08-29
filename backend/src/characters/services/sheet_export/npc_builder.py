"""Map NPC model instances to PDF AcroForm field values."""

from __future__ import annotations

from typing import Any

from characters.models import NPC

from .field_maps import MAX_CLOCK_SEGMENTS, STAND_STAT_KEYS
from .pc_builder import _checkbox, _format_inventory, _format_mapping, _playbook_label

NPC_STAND_KEY_MAP = {
    "power": ("POWER", "power"),
    "speed": ("SPEED", "speed"),
    "range": ("RANGE", "range"),
    "durability": ("DURABILITY", "durability"),
    "precision": ("PRECISION", "precision"),
    "development": ("DEVELOPMENT", "development", "POTENTIAL", "potential"),
}



def _npc_stand_grade(npc: NPC, stat: str) -> str:
    stats = npc.stand_coin_stats or {}
    keys = NPC_STAND_KEY_MAP.get(stat, (stat.upper(), stat))
    for key in keys:
        if key in stats and stats[key]:
            return str(stats[key]).upper()
    return ""


def _format_npc_abilities(npc: NPC) -> tuple[str, str]:
    lines: list[str] = []
    abilities = npc.abilities or []
    if isinstance(abilities, list):
        for item in abilities:
            if isinstance(item, dict):
                name = item.get("name") or "Ability"
                desc = item.get("description") or ""
                lines.append(f"{name}: {desc}" if desc else name)
            elif item:
                lines.append(str(item))
    for entry in npc.npc_hamon_abilities.select_related("hamon_ability").all():
        ha = entry.hamon_ability
        path = ha.get_hamon_type_display() if ha else "Hamon"
        level = int(getattr(ha, "required_a_count", 0) or 0)
        tag = f"[Hamon · {path}"
        if level > 0:
            tag += f" · Level {level}"
        tag += "]"
        desc = (ha.description or "").strip()
        lines.append(f"{tag} {ha.name}: {desc}" if desc else f"{tag} {ha.name}")
    for entry in npc.npc_spin_abilities.select_related("spin_ability").all():
        sa = entry.spin_ability
        path = sa.get_spin_type_display() if sa else "Spin"
        level = int(getattr(sa, "required_a_count", 0) or 0)
        tag = f"[Spin · {path}"
        if level > 0:
            tag += f" · Level {level}"
        tag += "]"
        desc = (sa.description or "").strip()
        lines.append(f"{tag} {sa.name}: {desc}" if desc else f"{tag} {sa.name}")
    if npc.custom_abilities:
        lines.append(npc.custom_abilities.strip())
    core = "\n".join(lines[:8])
    overflow = "\n".join(lines[8:])
    return core, overflow


def _clock_rows(npc: NPC) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    rows.append(
        {
            "name": "Vulnerability",
            "filled": int(npc.vulnerability_clock_current or 0),
            "segments": int(npc.vulnerability_clock_max or 0),
        }
    )
    for source in (npc.conflict_clocks or [], npc.alt_clocks or []):
        if isinstance(source, list):
            for clock in source:
                if isinstance(clock, dict):
                    rows.append(
                        {
                            "name": clock.get("name") or "Clock",
                            "filled": int(clock.get("filled") or 0),
                            "segments": int(clock.get("segments") or 4),
                        }
                    )
    for clock in npc.progress_clocks.all().order_by("id"):
        rows.append(
            {
                "name": clock.name or "Clock",
                "filled": int(clock.filled_segments or 0),
                "segments": int(clock.max_segments or 4),
            }
        )
    return rows


def build_npc_field_values(npc: NPC) -> dict[str, str]:
    """Return AcroForm field name -> value for an NPC sheet export."""
    npc = (
        NPC.objects.select_related("campaign", "faction", "heritage")
        .prefetch_related(
            "npc_hamon_abilities__hamon_ability",
            "npc_spin_abilities__spin_ability",
            "progress_clocks",
        )
        .get(pk=npc.pk)
    )

    values: dict[str, str] = {}
    values["npc_name"] = npc.name or ""
    values["npc_stand_name"] = npc.stand_name or ""
    values["npc_look"] = npc.appearance or ""
    values["npc_role"] = npc.role or ""
    values["npc_heritage"] = npc.heritage.name if npc.heritage_id else ""
    values["npc_playbook"] = _playbook_label(npc.playbook)
    values["npc_campaign"] = npc.campaign.name if npc.campaign_id else ""
    values["npc_faction"] = npc.faction.name if npc.faction_id else ""

    for stat in STAND_STAT_KEYS:
        values[f"npc_stand_{stat}"] = _npc_stand_grade(npc, stat)

    vuln_max = int(npc.vulnerability_clock_max or 0)
    vuln_cur = int(npc.vulnerability_clock_current or 0)
    values["npc_vulnerability"] = f"{vuln_cur}/{vuln_max}"
    for seg in range(MAX_CLOCK_SEGMENTS):
        values[f"npc_vuln_seg_{seg}"] = _checkbox(seg < min(vuln_cur, vuln_max))

    clocks = _clock_rows(npc)[1:5]
    while len(clocks) < 4:
        clocks.append({"name": "", "filled": 0, "segments": 0})
    for idx in range(4):
        slot = idx + 1
        clock = clocks[idx]
        values[f"npc_clock_{slot}_name"] = clock.get("name") or ""
        filled = int(clock.get("filled") or 0)
        segments = int(clock.get("segments") or 0)
        for seg in range(MAX_CLOCK_SEGMENTS):
            values[f"npc_clock_{slot}_seg_{seg}"] = _checkbox(
                seg < min(filled, segments) if segments else False
            )

    values["npc_weakness"] = npc.weakness or ""
    values["npc_need"] = npc.need or ""
    values["npc_desire"] = npc.desire or ""
    values["npc_rumour"] = npc.rumour or ""
    values["npc_secret"] = npc.secret or ""
    values["npc_passion"] = npc.passion or ""
    values["npc_description"] = npc.description or ""
    values["npc_stand_description"] = npc.stand_description or ""
    values["npc_stand_appearance"] = npc.stand_appearance or ""
    values["npc_stand_manifestation"] = npc.stand_manifestation or ""
    values["npc_special_traits"] = npc.special_traits or ""

    core, overflow = _format_npc_abilities(npc)
    values["npc_abilities"] = core
    values["npc_abilities_overflow"] = overflow
    values["npc_notes"] = npc.notes or ""
    values["npc_inventory_notes"] = npc.inventory_notes or ""
    values["npc_inventory"] = _format_inventory(npc.inventory) or _format_mapping(
        npc.items
    )
    values["npc_contacts"] = _format_mapping(npc.contacts)
    values["npc_relationships"] = _format_mapping(npc.relationships)
    values["npc_faction_status"] = _format_mapping(npc.faction_status)

    return values
