import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('characters', '0026_effect_extreme_roll_goal'),
    ]

    operations = [
        migrations.CreateModel(
            name='GroupAction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('goal_label', models.CharField(blank=True, max_length=300)),
                ('status', models.CharField(choices=[('OPEN', 'Open'), ('RESOLVED', 'Resolved')], default='OPEN', max_length=16)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('leader', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='led_group_actions', to='characters.character')),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_actions', to='characters.session')),
            ],
        ),
        migrations.AddField(
            model_name='roll',
            name='group_action',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='rolls',
                to='characters.groupaction',
            ),
        ),
    ]
