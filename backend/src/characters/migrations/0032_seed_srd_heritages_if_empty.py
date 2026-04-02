# Seed reference heritages when the table is empty (fresh DB / deploy without loaddata).
# Uses historical Heritage model only (no loaddata). Skips Django test databases so
# TestCase setUp data is authoritative (path is often .../test_*.sqlite3, not "test..." prefix).

from pathlib import Path

from django.db import migrations
from django.db.models import Max


def _is_test_database(name) -> bool:
    if name is None:
        return False
    s = str(name).lower()
    if s == ":memory:" or s.startswith("file:memorydb"):
        return True
    return Path(s).name.startswith("test")


def seed_if_empty(apps, schema_editor):
    db_name = schema_editor.connection.settings_dict.get("NAME")
    if _is_test_database(db_name):
        return

    Heritage = apps.get_model("characters", "Heritage")
    if Heritage.objects.exists():
        return

    # Human (pk=1) is required by SRD; srd_heritages fixture rows start at pk=2.
    Heritage.objects.create(
        pk=1,
        name="Human",
        base_hp=0,
        description="Versatile but without inherent supernatural abilities.",
    )
    srd_rows = [
        (2, "Rock Human", 2, "Resilient stone-like beings with natural stealth."),
        (3, "Vampire", 2, "Immortal predators vulnerable to sunlight and Hamon."),
        (4, "Pillar Man", 1, "Evolved ancients with heightened physicality and intelligence."),
        (5, "Gray Matter", 2, "Extraterrestrials adept at mimicry and shapeshifting."),
        (6, "Haunting", 2, "Partially spectral entities existing between life and death."),
        (7, "Cyborg", 2, "Humans enhanced with advanced cybernetics."),
        (8, "Oracle", 3, "Seers attuned deeply to the supernatural."),
    ]
    for pk, name, base_hp, description in srd_rows:
        Heritage.objects.create(pk=pk, name=name, base_hp=base_hp, description=description)

    if schema_editor.connection.vendor == "postgresql":
        table = Heritage._meta.db_table
        max_id = Heritage.objects.aggregate(m=Max("pk"))["m"] or 1
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                "SELECT setval(pg_get_serial_sequence(%s, 'id'), %s)",
                [table, max_id],
            )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0031_alter_session_devils_bargain_by_character"),
    ]

    operations = [
        migrations.RunPython(seed_if_empty, noop),
    ]
