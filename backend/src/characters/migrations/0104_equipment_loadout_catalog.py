# Generated manually for load/equipment catalog

from django.conf import settings
from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0098_sync_spin_hamon_abilities_srd"),
    ]

    operations = [
        migrations.CreateModel(
            name="EquipmentItem",
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
                ("name", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("documents", "Documents"),
                            ("gear", "Gear"),
                            ("implements", "Implements"),
                            ("supplies", "Supplies"),
                            ("tools", "Tools"),
                            ("weapons", "Weapons"),
                            ("other", "Other"),
                        ],
                        default="other",
                        max_length=20,
                    ),
                ),
                (
                    "load_slots",
                    models.IntegerField(
                        default=1,
                        help_text="0 = italicized (no load); 2 = heavy item.",
                        validators=[
                            django.core.validators.MinValueValidator(0),
                            django.core.validators.MaxValueValidator(2),
                        ],
                    ),
                ),
                (
                    "quality",
                    models.IntegerField(
                        default=1,
                        help_text="SRD quality factor hint (0 poor … 3 exceptional).",
                        validators=[
                            django.core.validators.MinValueValidator(0),
                            django.core.validators.MaxValueValidator(3),
                        ],
                    ),
                ),
                (
                    "coin_value",
                    models.IntegerField(
                        blank=True,
                        help_text="Optional resale/reference value in coin.",
                        null=True,
                    ),
                ),
                (
                    "scope",
                    models.CharField(
                        choices=[
                            ("TEMPLATE", "Template"),
                            ("CAMPAIGN", "Campaign"),
                            ("SITE", "Site"),
                        ],
                        default="CAMPAIGN",
                        max_length=20,
                    ),
                ),
                (
                    "available_when_adding",
                    models.BooleanField(
                        default=True,
                        help_text="When false, hidden from add-item picker for this campaign.",
                    ),
                ),
                (
                    "campaign",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.CASCADE,
                        related_name="equipment_items",
                        to="characters.campaign",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="created_equipment_items",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "source_character",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="promoted_equipment_items",
                        to="characters.character",
                    ),
                ),
            ],
            options={
                "ordering": ["category", "name"],
            },
        ),
        migrations.CreateModel(
            name="CampaignEquipmentAccess",
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
                ("enabled", models.BooleanField(default=True)),
                (
                    "campaign",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="equipment_access",
                        to="characters.campaign",
                    ),
                ),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="campaign_access",
                        to="characters.equipmentitem",
                    ),
                ),
            ],
            options={
                "unique_together": {("campaign", "item")},
            },
        ),
        migrations.AddField(
            model_name="session",
            name="loadout_by_character",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Map of character id (string) to session loadout: band, carried_ids, carry_coin, rigging_categories, armor_restored.",
            ),
        ),
    ]
