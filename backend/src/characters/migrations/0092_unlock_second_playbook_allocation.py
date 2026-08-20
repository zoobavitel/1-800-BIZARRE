from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0091_experience_tracker_revoked"),
    ]

    operations = [
        migrations.AlterField(
            model_name="characterxpallocation",
            name="allocation_type",
            field=models.CharField(
                choices=[
                    ("LEVEL_UP_STAT", "Level up — Stand Coin stat"),
                    ("LEVEL_UP_DOTS", "Level up — action dots"),
                    ("LEVEL_UP_HERITAGE", "Level up — heritage ability"),
                    ("MINOR_ADVANCE", "Minor advance — action dot"),
                    ("BUY_HP", "Buy +1 HP with XP"),
                    ("UNLOCK_SECOND_PLAYBOOK", "Unlock second playbook (30 XP)"),
                ],
                max_length=32,
            ),
        ),
    ]
