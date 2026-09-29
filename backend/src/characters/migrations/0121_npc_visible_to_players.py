# Generated manually for NPC.visible_to_players

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0120_progressclock_completion_dismiss"),
    ]

    operations = [
        migrations.AddField(
            model_name="npc",
            name="visible_to_players",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "When True and the faction allows players_see_npcs, players may see "
                    "this NPC on standing/roster views."
                ),
            ),
        ),
    ]
