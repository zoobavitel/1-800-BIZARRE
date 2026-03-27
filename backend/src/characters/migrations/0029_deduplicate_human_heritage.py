# Merge duplicate Heritage rows named "Human" (fixtures used to create two:
# initial_data pk=1 and srd_heritages pk=2). Keep lowest pk; move benefits,
# detriments, and character/NPC FKs; then delete extras.

from django.db import migrations


def deduplicate_human_heritage(apps, schema_editor):
    Heritage = apps.get_model('characters', 'Heritage')
    Benefit = apps.get_model('characters', 'Benefit')
    Detriment = apps.get_model('characters', 'Detriment')
    Character = apps.get_model('characters', 'Character')
    NPC = apps.get_model('characters', 'NPC')

    humans = list(Heritage.objects.filter(name__iexact='Human').order_by('pk'))
    if len(humans) <= 1:
        return

    keeper = humans[0]
    for h in humans[1:]:
        Benefit.objects.filter(heritage_id=h.id).update(heritage_id=keeper.id)
        Detriment.objects.filter(heritage_id=h.id).update(heritage_id=keeper.id)
        Character.objects.filter(heritage_id=h.id).update(heritage_id=keeper.id)
        NPC.objects.filter(heritage_id=h.id).update(heritage_id=keeper.id)
        Heritage.objects.filter(pk=h.id).delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('characters', '0028_alter_progressclock_max_segments'),
    ]

    operations = [
        migrations.RunPython(deduplicate_human_heritage, noop),
    ]
