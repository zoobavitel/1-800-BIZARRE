# Allow any common portrait format (GIF, WebP, etc.) without Pillow image validation.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('characters', '0035_character_stash_slots'),
    ]

    operations = [
        migrations.AlterField(
            model_name='character',
            name='image',
            field=models.FileField(blank=True, null=True, upload_to='character_images/'),
        ),
        migrations.AlterField(
            model_name='npc',
            name='image',
            field=models.FileField(blank=True, null=True, upload_to='npc_images/'),
        ),
        migrations.AlterField(
            model_name='crew',
            name='image',
            field=models.FileField(blank=True, null=True, upload_to='crew_images/'),
        ),
    ]
