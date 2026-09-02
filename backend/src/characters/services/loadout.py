"""Session loadout bands, caps, and armor restore on first band pick."""

from __future__ import annotations

from typing import Any

LOAD_BAND_CAPS = {
    "light": 3,
    "normal": 5,
    "heavy": 6,
    "encumbered": 9,
}
MULE_BAND_CAPS = {
    "light": 5,
    "normal": 7,
    "heavy": 8,
    "encumbered": 9,
}
VALID_BANDS = frozenset(LOAD_BAND_CAPS.keys())
RIGGING_CATEGORIES = frozenset(
    {"weapons", "implements", "supplies", "gear", "documents", "tools"}
)


def character_has_ability(character, name: str) -> bool:
    if character is None:
        return False
    return character.standard_abilities.filter(name__iexact=name).exists()


def load_cap_for_band(band: str, has_mule: bool = False) -> int:
    caps = MULE_BAND_CAPS if has_mule else LOAD_BAND_CAPS
    return caps.get(str(band or "").strip().lower(), 5)


def normalize_loadout_entry(raw: Any) -> dict:
    if not isinstance(raw, dict):
        return {}
    band = str(raw.get("band") or "").strip().lower()
    if band not in VALID_BANDS:
        band = ""
    carried = raw.get("carried_ids")
    if not isinstance(carried, list):
        carried = []
    carried_ids = [str(x) for x in carried if x is not None and str(x).strip()]
    rigging = raw.get("rigging_categories")
    if not isinstance(rigging, list):
        rigging = []
    rigging_categories = [
        str(c).strip().lower()
        for c in rigging
        if str(c).strip().lower() in RIGGING_CATEGORIES
    ]
    rigging_categories = rigging_categories[:2]
    out = {
        "band": band,
        "carried_ids": carried_ids,
        "carry_coin": bool(raw.get("carry_coin")),
        "rigging_categories": rigging_categories,
        "armor_restored": bool(raw.get("armor_restored")),
    }
    return out


def merge_loadout_map(existing: Any, patch: Any) -> dict:
    base = dict(existing or {})
    if not isinstance(patch, dict):
        return base
    for key, val in patch.items():
        char_key = str(key)
        if isinstance(val, dict):
            prev = normalize_loadout_entry(base.get(char_key))
            merged = {**prev, **normalize_loadout_entry(val)}
            # Preserve armor_restored once true
            if prev.get("armor_restored"):
                merged["armor_restored"] = True
            base[char_key] = merged
        else:
            base[char_key] = normalize_loadout_entry(val)
    return base


def compute_load_used(
    inventory: list[dict],
    carried_ids: list[str],
    carry_coin: bool,
    coin_filled: int = 0,
    rigging_categories: list[str] | None = None,
    has_rigging: bool = False,
) -> int:
    carried_set = {str(x) for x in carried_ids}
    by_id = {str(item.get("id")): item for item in inventory if item.get("id")}
    rigging_free: dict[str, int] = {}
    if has_rigging and rigging_categories:
        for cat in rigging_categories[:2]:
            rigging_free[cat] = 2

    total = 0
    for cid in carried_set:
        item = by_id.get(cid)
        if not item:
            continue
        load = int(item.get("load") or 0)
        if load <= 0:
            continue
        cat = str(item.get("category") or "other").lower()
        if rigging_free.get(cat, 0) > 0:
            rigging_free[cat] -= 1
            continue
        total += load
    if carry_coin and coin_filled > 0:
        total += int(coin_filled)
    return total


def restore_armor_for_character(character) -> None:
    """SRD: armor restored when choosing load for the next score."""
    character.stand_armor_used = 0
    character.physical_armor_used = 0
    character.special_armor_used = 0
    character.spin_armor_used = 0
    character.hamon_armor_used = 0
    character.light_armor_used = False
    character.medium_armor_used = False
    character.heavy_armor_used = False
    character.save(
        update_fields=[
            "stand_armor_used",
            "physical_armor_used",
            "special_armor_used",
            "spin_armor_used",
            "hamon_armor_used",
            "light_armor_used",
            "medium_armor_used",
            "heavy_armor_used",
        ]
    )


def apply_loadout_side_effects(
    character,
    old_entry: dict,
    new_entry: dict,
) -> dict:
    """
    On first band pick this session, restore armor and persist load cap on character.
    Returns updated new_entry (may set armor_restored).
    """
    new_band = new_entry.get("band") or ""
    if not new_band:
        return new_entry

    if not old_entry.get("armor_restored") and new_band:
        restore_armor_for_character(character)
        new_entry = dict(new_entry)
        new_entry["armor_restored"] = True

    cap = load_cap_for_band(
        new_band,
        has_mule=character_has_ability(character, "Mule"),
    )
    character.loadout = cap
    character.save(update_fields=["loadout"])
    return new_entry
