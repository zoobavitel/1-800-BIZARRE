# Deduplicate Vice records - keep lowest pk per name, point Characters to it

from django.db import migrations
from django.db.models import Count


def deduplicate_vices(apps, schema_editor):
    Vice = apps.get_model('characters', 'Vice')
    Character = apps.get_model('characters', 'Character')

    dup_names = list(
        Vice.objects.values('name')
        .annotate(cnt=Count('id'))
        .filter(cnt__gt=1)
        .values_list('name', flat=True)
    )

    for name in dup_names:
        vices = list(Vice.objects.filter(name=name).order_by('pk'))
        canonical = vices[0]
        dup_ids = [v.id for v in vices[1:]]
        Character.objects.filter(vice_id__in=dup_ids).update(vice_id=canonical.id)
        Vice.objects.filter(pk__in=dup_ids).delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('characters', '0022_showcasednpc_show_clocks_to_party'),
    ]

    operations = [
        migrations.RunPython(deduplicate_vices, noop),
    ]
