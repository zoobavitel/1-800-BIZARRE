import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("characters", "0050_alter_session_session_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="faction",
            name="visible_to_players",
            field=models.BooleanField(
                default=True,
                help_text="When false, crew reputation with this faction is hidden from players until the GM reveals it.",
            ),
        ),
        migrations.AddField(
            model_name="crew",
            name="turf",
            field=models.IntegerField(
                default=0,
                help_text="Crew turf track (0–6), Blades-style.",
            ),
        ),
        migrations.AddField(
            model_name="crew",
            name="notes",
            field=models.TextField(
                blank=True,
                help_text="Crew sheet notes (player-facing).",
            ),
        ),
        migrations.CreateModel(
            name="CrewHistory",
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
                ("timestamp", models.DateTimeField(auto_now_add=True)),
                ("changed_fields", models.JSONField()),
                (
                    "crew",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="history_entries",
                        to="characters.crew",
                    ),
                ),
                (
                    "editor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-timestamp"],
            },
        ),
    ]
