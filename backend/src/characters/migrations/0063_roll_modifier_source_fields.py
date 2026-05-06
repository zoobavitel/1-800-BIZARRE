from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0062_update_bizarre_intuition_srd_text"),
    ]

    operations = [
        migrations.AddField(
            model_name="roll",
            name="modifier_sources",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    "Structured source rows describing dice/stress/effect modifiers "
                    "applied to this roll."
                ),
            ),
        ),
        migrations.AddField(
            model_name="roll",
            name="position_effect_sources",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Structured source rows for position/effect adjustments on this roll.",
            ),
        ),
        migrations.AddField(
            model_name="roll",
            name="stress_sources",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Structured source rows for stress spend/gain tied to this roll.",
            ),
        ),
    ]
