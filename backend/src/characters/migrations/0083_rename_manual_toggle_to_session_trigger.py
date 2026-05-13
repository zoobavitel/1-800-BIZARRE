"""Rename legacy "Manual session XP toggle: …" rows to "Session XP trigger: …".

Trigger toggles (player/GM-confirmed end-of-session SRD trigger records) used
to ship with a description prefix that conflated them with free-form GM
"Add XP" track grants. Rewrite legacy rows so the audit list and any
description-prefix matching stays consistent with the new prefix; backend
revoke logic still recognises both prefixes for belt-and-suspenders.
"""

from django.db import migrations


LEGACY_PREFIX = "Manual session XP toggle"
NEW_PREFIX = "Session XP trigger"


def rename_descriptions_forward(apps, schema_editor):
    ExperienceTracker = apps.get_model("characters", "ExperienceTracker")
    qs = ExperienceTracker.objects.filter(
        description__startswith=f"{LEGACY_PREFIX}:",
    )
    for row in qs.iterator():
        row.description = (
            f"{NEW_PREFIX}{row.description[len(LEGACY_PREFIX):]}"
        )
        row.save(update_fields=["description"])


def rename_descriptions_backward(apps, schema_editor):
    ExperienceTracker = apps.get_model("characters", "ExperienceTracker")
    qs = ExperienceTracker.objects.filter(
        description__startswith=f"{NEW_PREFIX}:",
    )
    for row in qs.iterator():
        row.description = (
            f"{LEGACY_PREFIX}{row.description[len(NEW_PREFIX):]}"
        )
        row.save(update_fields=["description"])


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0082_experience_tracker_attribution"),
    ]

    operations = [
        migrations.RunPython(
            rename_descriptions_forward,
            rename_descriptions_backward,
        ),
    ]
