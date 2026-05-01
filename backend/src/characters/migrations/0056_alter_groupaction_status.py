from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0055_session_roll_goal_by_character"),
    ]

    operations = [
        migrations.AlterField(
            model_name="groupaction",
            name="status",
            field=models.CharField(
                choices=[
                    ("OPEN", "Open"),
                    ("RESOLVED", "Resolved"),
                    ("CANCELLED", "Cancelled"),
                ],
                default="OPEN",
                max_length=16,
            ),
        ),
    ]
