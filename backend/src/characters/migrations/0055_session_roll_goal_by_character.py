from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0054_groupaction_action_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="session",
            name="roll_goal_by_character",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Map of character id (string) to GM-set roll goal label for that player.",
            ),
        ),
    ]

