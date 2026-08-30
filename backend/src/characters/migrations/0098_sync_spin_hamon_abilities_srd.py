"""
Upsert Spin/Hamon playbook abilities from SRD fixtures.

Migration 0033 only loads when tables are empty; legacy partial catalogs
(e.g. three Spin foundations) never backfilled. This syncs every canonical
row from srd_spin_abilities.json and srd_hamon_abilities.json by name.
"""

import json
from pathlib import Path

from django.db import migrations

_FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"


def _load_fixture(name):
    path = _FIXTURES_DIR / name
    if not path.is_file():
        return []
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _upsert_spin_abilities(apps, entries):
    SpinAbility = apps.get_model("characters", "SpinAbility")
    for entry in entries:
        fields = entry.get("fields") or {}
        name = fields.get("name")
        if not name:
            continue
        SpinAbility.objects.update_or_create(
            name=name,
            defaults={
                "spin_type": fields.get("spin_type") or "FOUNDATION",
                "description": fields.get("description") or "",
                "required_a_count": int(fields.get("required_a_count") or 0),
                "stress_cost": int(fields.get("stress_cost") or 0),
                "frequency": fields.get("frequency") or "",
            },
        )


def _upsert_hamon_abilities(apps, entries):
    HamonAbility = apps.get_model("characters", "HamonAbility")
    for entry in entries:
        fields = entry.get("fields") or {}
        name = fields.get("name")
        if not name:
            continue
        HamonAbility.objects.update_or_create(
            name=name,
            defaults={
                "hamon_type": fields.get("hamon_type") or "FOUNDATION",
                "description": fields.get("description") or "",
                "required_a_count": int(fields.get("required_a_count") or 0),
                "stress_cost": int(fields.get("stress_cost") or 0),
                "frequency": fields.get("frequency") or "",
            },
        )


def sync_spin_hamon_abilities_from_fixtures(apps, schema_editor):
    _upsert_spin_abilities(apps, _load_fixture("srd_spin_abilities.json"))
    _upsert_hamon_abilities(apps, _load_fixture("srd_hamon_abilities.json"))


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0097_level_up_playbook_ability_allocation"),
    ]

    operations = [
        migrations.RunPython(
            sync_spin_hamon_abilities_from_fixtures,
            migrations.RunPython.noop,
        ),
    ]
