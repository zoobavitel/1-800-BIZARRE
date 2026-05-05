from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0063_roll_modifier_source_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="fed_today",
            field=models.BooleanField(
                blank=True,
                default=None,
                help_text=(
                    "Manual vampire feeding tracker used by sheet detriments "
                    "that depend on whether the character fed today."
                ),
                null=True,
            ),
        ),
    ]
