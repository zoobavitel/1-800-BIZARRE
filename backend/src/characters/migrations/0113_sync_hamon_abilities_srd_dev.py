"""Sync Hamon catalog to SRD_DEV: Overdrive Style, retire Ripple Infusion."""

import json
from pathlib import Path

from django.db import migrations, models

_FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"

_OVERDRIVE_STYLE = {
    "Guided Overdrive": 1,
    "Tornado Overdrive": 1,
    "Life Magnetism Overdrive": 2,
    "Turquoise Blue Overdrive": 2,
    "Sunlight Yellow Overdrive": 3,
    "Metal Silver Overdrive": 3,
    "Deep Pass Overdrive": 4,
}

_DESC_UPDATES = {
    "Sendō Overdrive": (
        "Strike targets through walls or barriers up to 65ft. "
        "Cannot conduct Hamon through metallic objects."
    ),
    "Scarlet Overdrive": (
        "Ignite a weapon or limb. Inflicts a fire-based secondary effect. "
        "Foes must resist or catch fire. Gains +1 effect vs vampires and pillarmen."
    ),
    "Guided Overdrive": (
        "Ripple arcs from your primary target to a second target within 30ft. "
        "The second target takes splash damage."
    ),
    "Metal Silver Overdrive": (
        "Ripple conducts through metallic objects (Sendo Overdrive upgrade)"
    ),
}


def _load_fixture():
    path = _FIXTURES_DIR / "srd_hamon_abilities.json"
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def sync_hamon_srd_dev(apps, schema_editor):
    HamonAbility = apps.get_model("characters", "HamonAbility")

    # Retire Ripple Infusion (removed from SRD_DEV Ripple Foundations).
    HamonAbility.objects.filter(name="Ripple Infusion").delete()

    for entry in _load_fixture():
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

    # Belt-and-suspenders for DBs whose fixture load path skipped rows.
    for name, level in _OVERDRIVE_STYLE.items():
        HamonAbility.objects.filter(name=name).update(
            hamon_type="OVERDRIVE_STYLE",
            required_a_count=level,
        )
    for name, description in _DESC_UPDATES.items():
        HamonAbility.objects.filter(name=name).update(description=description)


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0112_restore_swan_song"),
    ]

    operations = [
        migrations.AlterField(
            model_name="hamonability",
            name="hamon_type",
            field=models.CharField(
                choices=[
                    ("FOUNDATION", "Ripple Foundations"),
                    ("OVERDRIVE_STYLE", "Overdrive Style"),
                    ("CAESAR_STYLE", "Caesar Style"),
                    ("CYBER_STYLE", "Cyber Style"),
                    ("VAMPIRIC_STYLE", "Vampiric Style"),
                ],
                max_length=20,
            ),
        ),
        migrations.RunPython(sync_hamon_srd_dev, migrations.RunPython.noop),
    ]
