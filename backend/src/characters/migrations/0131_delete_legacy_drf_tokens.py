"""Delete the old DRF login tokens.

Login now uses django-rest-knox, and nothing reads the old token table. The
old tokens never expired, and some were written to the access log while the
event stream URL carried them. Deleting the rows makes sure none of them can
work again, even if the old auth class is ever turned back on.

Every user signs in once after this deploy. The reverse step does nothing:
deleted tokens cannot be restored, and nobody needs them.
"""

from django.db import migrations


def delete_legacy_tokens(apps, schema_editor):
    Token = apps.get_model("authtoken", "Token")
    Token.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0130_unpin_own_media_urls"),
        ("authtoken", "0004_alter_tokenproxy_options"),
    ]

    operations = [
        migrations.RunPython(delete_legacy_tokens, migrations.RunPython.noop),
    ]
