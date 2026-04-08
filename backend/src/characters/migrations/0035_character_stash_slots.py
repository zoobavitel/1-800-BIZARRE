# Generated manually for solo-character stash grid persistence.

import characters.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('characters', '0034_add_coin_boxes_and_stash_slots'),
    ]

    operations = [
        migrations.AddField(
            model_name='character',
            name='stash_slots',
            field=models.JSONField(
                blank=True,
                default=characters.models._default_stash_slots,
                help_text='Personal stash grid when not in a campaign crew; 40 booleans. Ignored in favor of crew.stash_slots when crew is set.',
            ),
        ),
    ]
