# Generated manually for ProgressClock completion + soft-dismiss

from django.db import migrations, models
import django.db.models.deletion


def backfill_completed(apps, schema_editor):
    ProgressClock = apps.get_model("characters", "ProgressClock")
    # Mark filled clocks complete; leave completed_at / completed_session null.
    ProgressClock.objects.filter(
        filled_segments__gte=models.F("max_segments"),
        max_segments__gt=0,
    ).update(completed=True)
    # Bidirectional: partial fill cannot stay completed=True.
    ProgressClock.objects.filter(completed=True).exclude(
        filled_segments__gte=models.F("max_segments"),
        max_segments__gt=0,
    ).update(completed=False)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0119_faction_players_see_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="progressclock",
            name="completed_at",
            field=models.DateTimeField(
                blank=True,
                help_text="When this clock last transitioned to completed.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="progressclock",
            name="completed_session",
            field=models.ForeignKey(
                blank=True,
                help_text="Session where the clock finished (not where it was created).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="completed_progress_clocks",
                to="characters.session",
            ),
        ),
        migrations.AddField(
            model_name="progressclock",
            name="dismissed_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Soft-hide from character sheet; retained for GM ledger.",
                null=True,
            ),
        ),
        migrations.RunPython(backfill_completed, noop_reverse),
    ]
