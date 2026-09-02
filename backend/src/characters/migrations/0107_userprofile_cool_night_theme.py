from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0106_character_special_armor_used"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userprofile",
            name="theme",
            field=models.CharField(
                choices=[
                    ("dark", "Dark"),
                    ("light", "Light"),
                    ("cool_night", "Cool Night"),
                ],
                default="dark",
                max_length=20,
            ),
        ),
    ]
