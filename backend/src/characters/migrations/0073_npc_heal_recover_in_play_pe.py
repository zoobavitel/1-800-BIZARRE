from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0072_npc_physical_armor_item_flags"),
    ]

    operations = [
        migrations.AddField(
            model_name="npc",
            name="heal_recover_in_play_position",
            field=models.CharField(
                blank=True,
                default="risky",
                help_text=(
                    "Default position for recover-in-play healing this NPC facilitates."
                ),
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="npc",
            name="heal_recover_in_play_effect",
            field=models.CharField(
                blank=True,
                default="standard",
                help_text=(
                    "Default effect tier for recover-in-play healing "
                    "(limited/standard/extreme)."
                ),
                max_length=16,
            ),
        ),
    ]
