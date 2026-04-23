from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0051_crew_turf_notes_faction_visible_crew_history"),
    ]

    operations = [
        migrations.AddField(
            model_name="roll",
            name="fortune_public_label",
            field=models.CharField(
                blank=True,
                help_text="Optional public-facing label explaining what the fortune roll was for.",
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name="roll",
            name="fortune_reveal_outcome",
            field=models.BooleanField(
                default=False,
                help_text="When false, non-GMs only see that a fortune roll happened.",
            ),
        ),
        migrations.AddField(
            model_name="sessionnpcinvolvement",
            name="revealed_ability_names",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="sessionnpcinvolvement",
            name="revealed_alt_clock_names",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="sessionnpcinvolvement",
            name="revealed_conflict_clock_names",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="sessionnpcinvolvement",
            name="revealed_progress_clock_ids",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="sessionnpcinvolvement",
            name="revealed_stand_coin_stats",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="sessionnpcinvolvement",
            name="show_all_abilities_to_players",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="sessionnpcinvolvement",
            name="show_harm_clock_to_players",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="sessionnpcinvolvement",
            name="show_stand_coin_to_players",
            field=models.BooleanField(default=False),
        ),
    ]
