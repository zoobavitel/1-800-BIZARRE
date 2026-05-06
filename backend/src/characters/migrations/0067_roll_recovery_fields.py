# Generated manually for Session History recovery roll linkage.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0066_remove_parry_and_break_ability"),
    ]

    operations = [
        migrations.AddField(
            model_name="roll",
            name="recovery_context",
            field=models.CharField(
                blank=True,
                default="",
                help_text=(
                    "self_downtime | self_mid_action | ally | empty — session history / recovery audits."
                ),
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="roll",
            name="recovery_target",
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Patient when another PC rolls recovery treatment for them."
                ),
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="recovery_rolls_received",
                to="characters.character",
            ),
        ),
    ]
