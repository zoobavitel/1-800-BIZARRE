# Generated manually for Ripple Breathing (once/session free push tracking).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0064_character_fed_today"),
    ]

    operations = [
        migrations.AddField(
            model_name="session",
            name="ripple_breathing_free_push_claimed_by_character",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    "Map of character id (string) to true after that PC uses Ripple "
                    "Breathing free push once for this session episode."
                ),
            ),
        ),
    ]
