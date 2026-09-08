# Allow common avatar formats (GIF, WebP, etc.) without Pillow image validation.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0110_advancement_plan_item"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userprofile",
            name="avatar",
            field=models.FileField(blank=True, null=True, upload_to="avatars/"),
        ),
        migrations.AlterField(
            model_name="userprofile",
            name="avatar_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text=(
                    "Optional HTTPS URL for profile picture "
                    "(fallback when no uploaded file)."
                ),
                max_length=500,
            ),
        ),
        migrations.AlterField(
            model_name="crew",
            name="image_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text=(
                    "Optional HTTPS URL for crew portrait "
                    "(fallback when no uploaded file)."
                ),
                max_length=500,
            ),
        ),
    ]
