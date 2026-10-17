from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0128_npc_players_see_inventory"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="harm_level1_resisted",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="character",
            name="harm_level1_slot2_resisted",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="character",
            name="harm_level2_resisted",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="character",
            name="harm_level2_slot2_resisted",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="character",
            name="harm_level3_resisted",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="character",
            name="harm_level4_resisted",
            field=models.BooleanField(default=False),
        ),
    ]
