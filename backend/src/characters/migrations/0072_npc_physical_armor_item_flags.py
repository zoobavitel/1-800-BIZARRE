import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0071_npc_heal_quality_fortune_dice"),
    ]

    operations = [
        migrations.AddField(
            model_name="npc",
            name="has_physical_armor_item",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "When False, this NPC has no physical armor pool (no item / no "
                    "gear granting −1 harm charges)."
                ),
            ),
        ),
        migrations.AddField(
            model_name="npc",
            name="physical_armor_bonus_charges",
            field=models.IntegerField(
                default=0,
                validators=[
                    django.core.validators.MinValueValidator(0),
                    django.core.validators.MaxValueValidator(6),
                ],
                help_text=(
                    "GM-tunable extra physical armor charges beyond the Durability "
                    "baseline (fiction, quality gear, on-the-fly grants)."
                ),
            ),
        ),
    ]
