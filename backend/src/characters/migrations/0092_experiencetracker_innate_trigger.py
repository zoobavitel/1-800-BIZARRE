from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0091_experience_tracker_revoked"),
    ]

    operations = [
        migrations.AlterField(
            model_name="experiencetracker",
            name="trigger",
            field=models.CharField(
                choices=[
                    (
                        "BELIEFS",
                        "Express beliefs, drives, heritage, or background",
                    ),
                    ("STRUGGLE", "Struggle with issues from vice or trauma"),
                    ("DESPERATE", "Address a challenge with action rating 0"),
                    ("DESPERATE_ROLL", "Desperate skill check"),
                    ("INNATE", "Innate desperate stand-dice roll"),
                    (
                        "PLAYBOOK_SPECIFIC",
                        "Playbook-specific XP (end of session)",
                    ),
                    ("MANUAL", "Manual or offline XP award"),
                ],
                max_length=24,
            ),
        ),
    ]
