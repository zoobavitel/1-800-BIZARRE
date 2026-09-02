"""Normalize character/NPC inventory JSON to structured kit rows."""

from __future__ import annotations

import uuid
from typing import Any

VALID_CATEGORIES = frozenset(
    {
        "documents",
        "gear",
        "implements",
        "supplies",
        "tools",
        "weapons",
        "other",
    }
)


def _clamp_int(value: Any, lo: int, hi: int, default: int) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def normalize_inventory_item(raw: Any) -> dict | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        name = raw.strip()
        if not name:
            return None
        return {
            "id": str(uuid.uuid4()),
            "name": name,
            "detail": "",
            "category": "other",
            "load": 1,
            "quality": 1,
            "coin_value": None,
            "catalog_id": None,
            "is_armor": False,
            "armor_kind": "",
        }
    if not isinstance(raw, dict):
        return None

    name = str(raw.get("name") or raw.get("label") or "").strip()
    item_id = raw.get("id")
    if not name and not item_id:
        return None
    if not item_id:
        item_id = str(uuid.uuid4())
    else:
        item_id = str(item_id)

    category = str(raw.get("category") or "other").strip().lower()
    if category not in VALID_CATEGORIES:
        category = "other"

    quality = _clamp_int(raw.get("quality"), 0, 3, 1)

    coin_raw = raw.get("coin_value")
    coin_value = None
    if coin_raw is not None and coin_raw != "":
        try:
            coin_value = max(0, int(coin_raw))
        except (TypeError, ValueError):
            coin_value = None

    catalog_raw = raw.get("catalog_id")
    catalog_id = None
    if catalog_raw is not None and catalog_raw != "":
        try:
            catalog_id = int(catalog_raw)
        except (TypeError, ValueError):
            catalog_id = None

    detail = str(raw.get("detail") or raw.get("description") or "").strip()

    armor_kind_raw = str(raw.get("armor_kind") or "").strip().lower()
    if armor_kind_raw in ("standard", "heavy", "special"):
        armor_kind = armor_kind_raw
    elif raw.get("is_armor"):
        armor_kind = "standard"
    else:
        armor_kind = ""
    is_armor = armor_kind in ("standard", "heavy")

    if armor_kind in ("standard", "heavy"):
        load = 0
    else:
        load = _clamp_int(raw.get("load", raw.get("load_slots")), 0, 2, 1)

    return {
        "id": item_id,
        "name": name or "Item",
        "detail": detail,
        "category": category,
        "load": load,
        "quality": quality,
        "coin_value": coin_value,
        "catalog_id": catalog_id,
        "is_armor": is_armor,
        "armor_kind": armor_kind,
    }


def normalize_inventory_list(inv: Any) -> list[dict]:
    if inv is None:
        return []
    if isinstance(inv, dict):
        inv = [inv]
    if not isinstance(inv, list):
        return []
    out: list[dict] = []
    for raw in inv:
        norm = normalize_inventory_item(raw)
        if norm:
            out.append(norm)
    return out
