from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0105_remove_junk_heritages_h_h2"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="special_armor_used",
            field=models.IntegerField(
                default=0,
                help_text=(
                    "Spent special armor boxes from inventory items (armor_kind=special). "
                    "One box per item; restored when load is chosen for the next score."
                ),
            ),
        ),
    ]
