"""
Remove retired standard abilities from the catalog and character sheets;
add Guardian Angel per SRD rewrite.
"""

from django.db import migrations

_REMOVED_DISPLAY_NAMES = (
    "Legendary Guard",
    "Neural Lace",
    "Notorious",
    "Guardian",
    "Automatic Trigger",
)

_REMOVED_NAMES = frozenset(n.lower() for n in _REMOVED_DISPLAY_NAMES)

_GUARDIAN_ANGEL = {
    "name": "Guardian Angel",
    "type": "standard",
    "category": "teamwork",
    "description": (
        "Your Stand can manufacture armor for others. Take 2 stress to give an ally "
        "within Range one Stand Armor charge. They hold it and may check it themselves "
        "to reduce a consequence by 1 level. Unspent charges vanish at the end of the "
        "scene. You cannot give a given ally more than one charge per scene."
    ),
}


def _norm_name(value):
    return str(value or "").strip().lower()


def _filtered_json_list(lst):
    out = []
    changed = False
    for entry in lst:
        if isinstance(entry, dict) and _norm_name(entry.get("name")) in _REMOVED_NAMES:
            changed = True
            continue
        out.append(entry)
    return out, changed


def sync_standard_abilities_srd(apps, schema_editor):
    Ability = apps.get_model("characters", "Ability")
    Character = apps.get_model("characters", "Character")
    NPC = apps.get_model("characters", "NPC")
    Stand = apps.get_model("characters", "Stand")

    Ability.objects.get_or_create(
        name=_GUARDIAN_ANGEL["name"],
        defaults={
            "type": _GUARDIAN_ANGEL["type"],
            "category": _GUARDIAN_ANGEL["category"],
            "description": _GUARDIAN_ANGEL["description"],
        },
    )

    for character in Character.objects.all().iterator():
        update_fields = []
        extra = getattr(character, "extra_custom_abilities", None)
        if isinstance(extra, list) and extra:
            filtered_extra, changed_x = _filtered_json_list(extra)
            if changed_x:
                character.extra_custom_abilities = filtered_extra
                update_fields.append("extra_custom_abilities")

        temp = getattr(character, "development_temporary_ability", None)
        if isinstance(temp, dict) and _norm_name(temp.get("name")) in _REMOVED_NAMES:
            character.development_temporary_ability = None
            update_fields.append("development_temporary_ability")

        if update_fields:
            character.save(update_fields=update_fields)

    for npc in NPC.objects.all().iterator():
        raw = getattr(npc, "abilities", None)
        if isinstance(raw, list) and raw:
            filtered, changed = _filtered_json_list(raw)
            if changed:
                npc.abilities = filtered
                npc.save(update_fields=["abilities"])

    removed_objs = list(Ability.objects.filter(name__in=_REMOVED_DISPLAY_NAMES))
    removed_pks = [a.pk for a in removed_objs]
    if removed_pks:
        Stand.objects.filter(standard_ability_id__in=removed_pks).update(
            standard_ability_id=None
        )
        for ab in removed_objs:
            linked = Character.objects.filter(standard_abilities__pk=ab.pk)
            for ch in linked.distinct():
                ch.standard_abilities.remove(ab)
        Ability.objects.filter(pk__in=removed_pks).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0095_srd_sync_stand_armor_fields"),
    ]

    operations = [
        migrations.RunPython(sync_standard_abilities_srd, migrations.RunPython.noop),
    ]
