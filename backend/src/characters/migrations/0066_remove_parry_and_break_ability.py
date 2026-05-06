"""
Remove Parry and Break from the Ability catalog and character sheets.
"""

from django.db import migrations


def remove_parry_and_break(apps, schema_editor):
    Ability = apps.get_model("characters", "Ability")
    Character = apps.get_model("characters", "Character")
    NPC = apps.get_model("characters", "NPC")
    StandAbility = apps.get_model("characters", "StandAbility")

    def filtered_json_list(lst):
        out = []
        changed = False
        for entry in lst:
            if isinstance(entry, dict):
                nm = str(entry.get("name") or "").strip().lower()
                if nm == "parry and break":
                    changed = True
                    continue
            out.append(entry)
        return out, changed

    for character in Character.objects.all().iterator():
        update_fields = []
        extra = getattr(character, "extra_custom_abilities", None)
        if isinstance(extra, list) and extra:
            filtered_extra, changed_x = filtered_json_list(extra)
            if changed_x:
                character.extra_custom_abilities = filtered_extra
                update_fields.append("extra_custom_abilities")

        temp = getattr(character, "development_temporary_ability", None)
        if isinstance(temp, dict):
            nm = str(temp.get("name") or "").strip().lower()
            if nm == "parry and break":
                character.development_temporary_ability = None
                update_fields.append("development_temporary_ability")

        if update_fields:
            character.save(update_fields=update_fields)

    for npc in NPC.objects.all().iterator():
        raw = getattr(npc, "abilities", None)
        if isinstance(raw, list) and raw:
            filtered, changed = filtered_json_list(raw)
            if changed:
                npc.abilities = filtered
                npc.save(update_fields=["abilities"])

    StandAbility.objects.filter(name__iexact="Parry and Break").delete()
    Ability.objects.filter(name__iexact="Parry and Break").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0065_session_ripple_breathing_free_push"),
    ]

    operations = [
        migrations.RunPython(remove_parry_and_break, migrations.RunPython.noop),
    ]
