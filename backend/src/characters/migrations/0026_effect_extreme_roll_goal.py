from django.db import migrations, models


def forwards_greater_to_extreme(apps, schema_editor):
    Roll = apps.get_model('characters', 'Roll')
    Session = apps.get_model('characters', 'Session')
    Roll.objects.filter(effect='greater').update(effect='extreme')
    Session.objects.filter(default_effect='greater').update(default_effect='extreme')


def noop_reverse(apps, schema_editor):
    Roll = apps.get_model('characters', 'Roll')
    Session = apps.get_model('characters', 'Session')
    Roll.objects.filter(effect='extreme').update(effect='greater')
    Session.objects.filter(default_effect='extreme').update(default_effect='greater')


class Migration(migrations.Migration):

    dependencies = [
        ('characters', '0025_character_personal_crew_name'),
    ]

    operations = [
        migrations.RunPython(forwards_greater_to_extreme, noop_reverse),
        migrations.AlterField(
            model_name='roll',
            name='effect',
            field=models.CharField(
                choices=[('limited', 'Limited'), ('standard', 'Standard'), ('extreme', 'Extreme')],
                default='standard',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='roll',
            name='goal_label',
            field=models.CharField(blank=True, help_text='Goal or intent label for this roll (often from session roll_goal_label).', max_length=300),
        ),
        migrations.AddField(
            model_name='session',
            name='roll_goal_label',
            field=models.CharField(
                blank=True,
                help_text='GM-set label for the current roll goal; copied to Roll on commit.',
                max_length=300,
            ),
        ),
    ]
