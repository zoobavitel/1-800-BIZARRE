from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0046_sessionnpcinvolvement_show_vulnerability_clock"),
    ]

    operations = [
        migrations.AddField(
            model_name="npc",
            name="inventory_notes",
            field=models.TextField(blank=True),
        ),
    ]
