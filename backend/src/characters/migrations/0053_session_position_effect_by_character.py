from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0052_gm_tracking_reveal_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="session",
            name="position_effect_by_character",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Map of character id (string) to {position, effect} for this session; overrides default_position/default_effect for that PC's action rolls when set.",
            ),
        ),
    ]
