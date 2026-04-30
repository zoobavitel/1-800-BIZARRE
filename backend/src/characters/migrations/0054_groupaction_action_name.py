from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0053_session_position_effect_by_character"),
    ]

    operations = [
        migrations.AddField(
            model_name="groupaction",
            name="action_name",
            field=models.CharField(
                blank=True,
                help_text="Required action for this group action (e.g. skirmish, survey).",
                max_length=32,
            ),
        ),
    ]

