# Generated manually for AssistHelpPending (crew assist credit per session/recipient).

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0067_roll_recovery_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="AssistHelpPending",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assist_help_pending",
                        to="characters.session",
                    ),
                ),
                (
                    "recipient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assist_help_pending_received",
                        to="characters.character",
                    ),
                ),
                (
                    "helper",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assist_help_pending_given",
                        to="characters.character",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="assisthelppending",
            constraint=models.UniqueConstraint(
                fields=("session", "recipient"),
                name="uniq_assist_help_pending_session_recipient",
            ),
        ),
    ]
