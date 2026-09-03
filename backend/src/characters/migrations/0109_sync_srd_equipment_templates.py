"""Upsert canonical SRD TEMPLATE equipment kits; prune obsolete TEMPLATE names."""

from django.db import migrations


def upsert_srd_equipment_templates(apps, schema_editor):
    from characters.services.equipment_template_sync import sync_srd_equipment_templates

    sync_srd_equipment_templates(prune_obsolete=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0108_pending_advance_single_playbook"),
    ]

    operations = [
        migrations.RunPython(upsert_srd_equipment_templates, noop_reverse),
    ]
