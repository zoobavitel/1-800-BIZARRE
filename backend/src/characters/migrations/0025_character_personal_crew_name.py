from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('characters', '0024_vice_name_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='character',
            name='personal_crew_name',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
    ]
