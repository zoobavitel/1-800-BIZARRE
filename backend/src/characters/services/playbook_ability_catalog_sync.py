"""Upsert Spin/Hamon playbook ability catalog rows from SRD JSON fixtures."""

from __future__ import annotations

import json
from pathlib import Path

from ..models import HamonAbility, SpinAbility

_FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"


def _load_fixture(name: str) -> list:
    path = _FIXTURES_DIR / name
    if not path.is_file():
        return []
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def sync_spin_abilities_from_fixture() -> int:
    updated = 0
    for entry in _load_fixture("srd_spin_abilities.json"):
        fields = entry.get("fields") or {}
        name = fields.get("name")
        if not name:
            continue
        _, created = SpinAbility.objects.update_or_create(
            name=name,
            defaults={
                "spin_type": fields.get("spin_type") or "FOUNDATION",
                "description": fields.get("description") or "",
                "required_a_count": int(fields.get("required_a_count") or 0),
                "stress_cost": int(fields.get("stress_cost") or 0),
                "frequency": fields.get("frequency") or "",
            },
        )
        if created:
            updated += 1
    return updated


def sync_hamon_abilities_from_fixture() -> int:
    updated = 0
    for entry in _load_fixture("srd_hamon_abilities.json"):
        fields = entry.get("fields") or {}
        name = fields.get("name")
        if not name:
            continue
        _, created = HamonAbility.objects.update_or_create(
            name=name,
            defaults={
                "hamon_type": fields.get("hamon_type") or "FOUNDATION",
                "description": fields.get("description") or "",
                "required_a_count": int(fields.get("required_a_count") or 0),
                "stress_cost": int(fields.get("stress_cost") or 0),
                "frequency": fields.get("frequency") or "",
            },
        )
        if created:
            updated += 1
    return updated


def sync_playbook_ability_catalog() -> dict[str, int]:
    return {
        "spin_created": sync_spin_abilities_from_fixture(),
        "hamon_created": sync_hamon_abilities_from_fixture(),
    }
