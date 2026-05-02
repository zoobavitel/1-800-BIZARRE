from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0057_remove_npc_harm_clock_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="faction",
            name="image",
            field=models.FileField(
                blank=True,
                help_text="Optional emblem or photo for this faction.",
                null=True,
                upload_to="faction_images/",
            ),
        ),
    ]
