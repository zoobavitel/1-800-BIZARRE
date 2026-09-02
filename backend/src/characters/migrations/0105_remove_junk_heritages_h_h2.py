"""Remove junk test heritages H and H2 from the catalog."""

from django.db import migrations


def remove_junk_heritages(apps, schema_editor):
    Heritage = apps.get_model("characters", "Heritage")
    Character = apps.get_model("characters", "Character")
    junk = Heritage.objects.filter(name__in=["H", "H2"])
    if not junk.exists():
        return
    human = Heritage.objects.filter(name="Human").first()
    if human:
        Character.objects.filter(heritage__in=junk).update(heritage=human)
    junk.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0104_equipment_loadout_catalog"),
    ]

    operations = [
        migrations.RunPython(remove_junk_heritages, migrations.RunPython.noop),
    ]
