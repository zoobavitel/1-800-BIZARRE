# Generated manually for NPC.pc_standing

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0122_session_default_ordering"),
    ]

    operations = [
        migrations.AddField(
            model_name="npc",
            name="pc_standing",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    "This NPC's personal standing toward campaign player characters "
                    "(-3 to +3), keyed by character id string."
                ),
            ),
        ),
    ]
