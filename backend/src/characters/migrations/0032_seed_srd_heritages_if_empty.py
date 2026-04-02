# Seed reference heritages when the table is empty (fresh DB / deploy without loaddata).

from django.core.management import call_command
from django.db import migrations


def seed_if_empty(apps, schema_editor):
    Heritage = apps.get_model("characters", "Heritage")
    if Heritage.objects.exists():
        return
    # Human (pk=1) is required by SRD; srd_heritages.json starts at pk=2.
    Heritage.objects.create(
        pk=1,
        name="Human",
        base_hp=0,
        description="Versatile but without inherent supernatural abilities.",
    )
    call_command("loaddata", "srd_heritages", verbosity=0)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0031_alter_session_devils_bargain_by_character"),
    ]

    operations = [
        migrations.RunPython(seed_if_empty, noop),
    ]
