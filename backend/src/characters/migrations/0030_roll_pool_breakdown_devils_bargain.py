from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('characters', '0029_deduplicate_human_heritage'),
    ]

    operations = [
        migrations.AddField(
            model_name='session',
            name='devils_bargain_by_character',
            field=models.JSONField(blank=True, default=dict, help_text='Map of character id (string) to GM-written devil\'s bargain consequence text.'),
        ),
        migrations.AddField(
            model_name='roll',
            name='pool_action_rating',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='roll',
            name='pool_attribute_dice',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='roll',
            name='push_for_effect',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='roll',
            name='push_for_dice',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='roll',
            name='uses_devil_bargain',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='roll',
            name='pool_assist_dice',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='roll',
            name='pool_bonus_dice',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='roll',
            name='roller_stress_spent',
            field=models.PositiveSmallIntegerField(default=0, help_text='Stress spent by the rolling character (push, etc.).'),
        ),
        migrations.AddField(
            model_name='roll',
            name='devil_bargain_consequence',
            field=models.CharField(blank=True, max_length=500),
        ),
    ]
