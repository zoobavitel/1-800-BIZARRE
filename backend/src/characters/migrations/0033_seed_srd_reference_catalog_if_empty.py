# Load SRD reference fixtures when catalog tables are empty (deploy without manual loaddata).
# Skips Django test databases (same rationale as 0032).

from pathlib import Path

from django.core.management import call_command
from django.db import migrations


def _is_test_database(name) -> bool:
    if name is None:
        return False
    s = str(name).lower()
    if s == ":memory:" or s.startswith("file:memorydb"):
        return True
    return Path(s).name.startswith("test")


def seed_catalog_if_empty(apps, schema_editor):
    db_name = schema_editor.connection.settings_dict.get("NAME")
    if _is_test_database(db_name):
        return

    Benefit = apps.get_model("characters", "Benefit")
    Detriment = apps.get_model("characters", "Detriment")
    Ability = apps.get_model("characters", "Ability")
    HamonAbility = apps.get_model("characters", "HamonAbility")
    SpinAbility = apps.get_model("characters", "SpinAbility")

    if not Benefit.objects.exists():
        call_command("loaddata", "srd_benefits", verbosity=0)
    if not Detriment.objects.exists():
        call_command("loaddata", "srd_detriments", verbosity=0)
    if not Ability.objects.exists():
        call_command("loaddata", "standard_abilities", verbosity=0)
    if not HamonAbility.objects.exists():
        call_command("loaddata", "srd_hamon_abilities", verbosity=0)
    if not SpinAbility.objects.exists():
        call_command("loaddata", "srd_spin_abilities", verbosity=0)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0032_seed_srd_heritages_if_empty"),
    ]

    operations = [
        migrations.RunPython(seed_catalog_if_empty, noop),
    ]
