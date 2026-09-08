"""Restore Swan Song to the standard ability catalog (SRD_DEV)."""

from django.db import migrations

_SWAN_SONG = {
    "name": "Swan Song",
    "type": "standard",
    "category": "endurance",
    "description": (
        "When you would be taken out by harm (Level 4), you may spend all "
        "remaining Stand armor charges (minimum 1) to remain standing for a "
        "short but heroic moment. You can take one last action before you "
        "collapse. If that action prevents or cancels the harm, you remain "
        "conscious."
    ),
}


def restore_swan_song(apps, schema_editor):
    Ability = apps.get_model("characters", "Ability")
    existing = Ability.objects.filter(name="Swan Song", type="standard").first()
    if existing is None:
        # Prefer historical pk 19 when free (fixture gap after Undying Will).
        if not Ability.objects.filter(pk=19).exists():
            Ability.objects.create(pk=19, **_SWAN_SONG)
        else:
            Ability.objects.create(**_SWAN_SONG)
        return
    updates = []
    for field, value in _SWAN_SONG.items():
        if getattr(existing, field) != value:
            setattr(existing, field, value)
            updates.append(field)
    if updates:
        existing.save(update_fields=updates)


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0111_userprofile_avatar_filefield"),
    ]

    operations = [
        migrations.RunPython(restore_swan_song, migrations.RunPython.noop),
    ]
