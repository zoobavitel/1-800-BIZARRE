from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0056_alter_groupaction_status"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="sessionnpcinvolvement",
            name="show_harm_clock_to_players",
        ),
        migrations.RemoveField(
            model_name="npc",
            name="harm_clock_current",
        ),
        migrations.RemoveField(
            model_name="npc",
            name="harm_clock_max",
        ),
    ]
