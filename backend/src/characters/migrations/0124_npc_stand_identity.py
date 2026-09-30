# Generated manually for NPC stand identity flavor fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0123_npc_pc_standing"),
    ]

    operations = [
        migrations.AddField(
            model_name="npc",
            name="stand_identity_types",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    "Stand type keys for NPC flavor identity (COLONY, AUTOMATIC, etc.). "
                    "Not wired to PC session XP archetypes."
                ),
            ),
        ),
        migrations.AddField(
            model_name="npc",
            name="stand_type_custom",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Optional fiction-only Stand subtype label.",
                max_length=100,
            ),
        ),
        migrations.AddField(
            model_name="npc",
            name="stand_forms",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    "Stand form labels (Humanoid / Non-Humanoid / Phenomenon / custom)."
                ),
            ),
        ),
        migrations.AddField(
            model_name="npc",
            name="stand_consciousness",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Flavor consciousness grade A–F (empty allowed).",
                max_length=1,
            ),
        ),
    ]
