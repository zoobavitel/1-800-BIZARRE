from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0127_faction_status_visibility"),
    ]

    operations = [
        migrations.AddField(
            model_name="npc",
            name="players_see_inventory",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "When True (and the NPC is visible_to_players), players may "
                    "see this NPC's inventory on the sheet."
                ),
            ),
        ),
    ]
