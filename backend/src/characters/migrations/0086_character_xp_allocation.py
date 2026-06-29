# Generated manually for CharacterXPAllocation and advancement fields.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("characters", "0085_character_secondary_playbook"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="advancement_ability_grants",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    "Custom abilities granted via XP advancement (each entry may include "
                    "allocation_id for undo)."
                ),
            ),
        ),
        migrations.AlterField(
            model_name="character",
            name="custom_ability_type",
            field=models.CharField(
                choices=[
                    ("single_with_2_uses", "Single Ability with 2 Uses"),
                    ("single_with_3_uses", "Single Ability with 3 Uses"),
                    ("three_separate_uses", "Three Separate Abilities"),
                ],
                default="single_with_3_uses",
                max_length=32,
            ),
        ),
        migrations.CreateModel(
            name="CharacterXPAllocation",
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
                    "allocation_type",
                    models.CharField(
                        choices=[
                            ("LEVEL_UP_STAT", "Level up — Stand Coin stat"),
                            ("LEVEL_UP_DOTS", "Level up — action dots"),
                            ("MINOR_ADVANCE", "Minor advance — action dot"),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    "xp_track",
                    models.CharField(
                        choices=[
                            ("insight", "Insight"),
                            ("prowess", "Prowess"),
                            ("resolve", "Resolve"),
                            ("heritage", "Heritage"),
                            ("playbook", "Playbook"),
                        ],
                        max_length=16,
                    ),
                ),
                ("xp_cost", models.PositiveIntegerField()),
                ("payload_before", models.JSONField(blank=True, default=dict)),
                ("payload_after", models.JSONField(blank=True, default=dict)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("undone_at", models.DateTimeField(blank=True, null=True)),
                (
                    "character",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="xp_allocations",
                        to="characters.character",
                    ),
                ),
                (
                    "undone_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="undone_xp_allocations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
    ]
