from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0049_session_proposed_date"),
    ]

    operations = [
        migrations.AlterField(
            model_name="session",
            name="session_date",
            field=models.DateTimeField(default=timezone.now),
        ),
    ]
