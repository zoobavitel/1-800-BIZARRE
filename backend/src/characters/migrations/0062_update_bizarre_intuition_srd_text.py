# Align Bizarre Intuition ability text with docs/1(800)-Bizarre SRD.md (no "act first in ambush").

from django.db import migrations


NEW_DESCRIPTION = (
    "You have a bizarre sense for danger. You cannot be surprised."
)


def forwards(apps, schema_editor):
    Ability = apps.get_model("characters", "Ability")
    Ability.objects.filter(name="Bizarre Intuition").update(
        description=NEW_DESCRIPTION
    )


def backwards(apps, schema_editor):
    Ability = apps.get_model("characters", "Ability")
    Ability.objects.filter(name="Bizarre Intuition").update(
        description=(
            "You have a bizarre sense for danger. You cannot be surprised "
            "and always act first in ambush situations."
        )
    )


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0061_alter_experiencetracker_trigger"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
