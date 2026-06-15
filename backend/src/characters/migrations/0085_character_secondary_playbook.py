from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0084_character_playbook_xp_archetypes_playbook_specific"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="secondary_playbook",
            field=models.CharField(
                blank=True,
                choices=[
                    ("STAND", "Stand"),
                    ("HAMON", "Hamon"),
                    ("SPIN", "Spin"),
                ],
                default=None,
                max_length=20,
                null=True,
            ),
        ),
    ]
