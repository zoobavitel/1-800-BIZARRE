# Generated manually for faction peer standing visibility.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0126_npc_visible_to_players_help_text"),
    ]

    operations = [
        migrations.AddField(
            model_name="faction",
            name="faction_status_visibility",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    "Peer faction name → bool. When false, players do not see that "
                    "standing edge. Missing key means visible."
                ),
            ),
        ),
    ]
