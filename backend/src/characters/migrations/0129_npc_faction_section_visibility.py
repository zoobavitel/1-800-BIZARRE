from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0128_npc_players_see_inventory"),
    ]

    operations = [
        migrations.AddField(
            model_name="faction",
            name="players_see_contacts",
            field=models.BooleanField(
                default=True,
                help_text="When true (and visible_to_players), players may see faction contacts.",
            ),
        ),
        migrations.AddField(
            model_name="faction",
            name="players_see_faction_status",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "When true (and visible_to_players), players may see this faction's "
                    "standing toward other factions. Per-edge faction_status_visibility "
                    "still applies."
                ),
            ),
        ),
        migrations.AddField(
            model_name="faction",
            name="players_see_identity",
            field=models.BooleanField(
                default=True,
                help_text="When true (and visible_to_players), players may see faction name and type.",
            ),
        ),
        migrations.AddField(
            model_name="faction",
            name="players_see_inventory",
            field=models.BooleanField(
                default=True,
                help_text="When true (and visible_to_players), players may see shared faction inventory.",
            ),
        ),
        migrations.AddField(
            model_name="npc",
            name="players_see",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    "Section key → bool for campaign player visibility "
                    "(playbook, abilities, pc_standing, faction_membership, notes, "
                    "stand_identity, heritage, forms, consciousness, contacts, "
                    "crew_standing). Missing key means visible."
                ),
            ),
        ),
    ]
