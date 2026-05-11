from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0069_character_disguised_as_human"),
    ]

    operations = [
        migrations.AddField(
            model_name="npc",
            name="stand_armor_used",
            field=models.IntegerField(default=0),
        ),
    ]
