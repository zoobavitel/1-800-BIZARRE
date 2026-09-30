# Generated manually for Character.npc_standing

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0124_npc_stand_identity"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="npc_standing",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    "This character's personal standing toward campaign NPCs "
                    "(-3 to +3), keyed by NPC id string. Distinct from crew/faction "
                    "reputation."
                ),
            ),
        ),
    ]
