import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0070_npc_stand_armor_used"),
    ]

    operations = [
        migrations.AddField(
            model_name="npc",
            name="heal_quality_fortune_dice",
            field=models.IntegerField(
                default=2,
                validators=[
                    django.core.validators.MinValueValidator(1),
                    django.core.validators.MaxValueValidator(4),
                ],
                help_text=(
                    "Quality tier as dice: how many d6 for a fortune roll when this "
                    "NPC treats or stabilizes someone (downtime or in-play recover), "
                    "for any valid patient (self, another NPC, or a campaign PC)."
                ),
            ),
        ),
    ]
