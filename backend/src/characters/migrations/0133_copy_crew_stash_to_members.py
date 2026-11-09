"""Stash is personal; copy each crew's shared grid into its members once."""

from django.db import migrations


def forwards(apps, schema_editor):
    from characters.services.stash_personal import copy_crew_stash_to_members

    copy_crew_stash_to_members(
        apps.get_model("characters", "Crew"),
        apps.get_model("characters", "Character"),
    )


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0132_character_version"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
