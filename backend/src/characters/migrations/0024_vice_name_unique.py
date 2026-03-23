from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('characters', '0023_deduplicate_vices'),
    ]

    operations = [
        migrations.AlterField(
            model_name='vice',
            name='name',
            field=models.CharField(max_length=100, unique=True),
        ),
    ]
