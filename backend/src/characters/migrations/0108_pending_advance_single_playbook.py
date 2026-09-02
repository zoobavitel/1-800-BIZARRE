"""PendingAdvance model; null secondary_playbook; pin heritage HP; remove Spin Armor."""

from django.db import migrations, models
import django.db.models.deletion


SRD_BASE_HP = {
    "Human": 0,
    "Rock Human": 2,
    "Vampire": 2,
    "Pillar Man": 1,
    "Gray Matter": 2,
    "Haunting": 2,
    "Cyborg": 2,
    "Oracle": 3,
}

TRACK_CAPS = {
    "insight": 5,
    "prowess": 5,
    "resolve": 5,
    "heritage": 5,
    "playbook": 10,
}


def pin_heritage_base_hp(apps, schema_editor):
    Heritage = apps.get_model("characters", "Heritage")
    for name, hp in SRD_BASE_HP.items():
        Heritage.objects.filter(name=name).update(base_hp=hp)


def clear_secondary_playbook(apps, schema_editor):
    Character = apps.get_model("characters", "Character")
    Character.objects.exclude(secondary_playbook__isnull=True).exclude(
        secondary_playbook=""
    ).update(secondary_playbook=None)


def delete_spin_armor_row(apps, schema_editor):
    SpinAbility = apps.get_model("characters", "SpinAbility")
    CharacterSpinAbility = apps.get_model("characters", "CharacterSpinAbility")
    armor_ids = list(
        SpinAbility.objects.filter(name__iexact="Spin Armor").values_list(
            "id", flat=True
        )
    )
    if not armor_ids:
        return
    CharacterSpinAbility.objects.filter(spin_ability_id__in=armor_ids).delete()
    SpinAbility.objects.filter(id__in=armor_ids).delete()


def convert_full_tracks_to_pendings(apps, schema_editor):
    """Legacy marks at/above cap → mint open pendings + leftover marks."""
    Character = apps.get_model("characters", "Character")
    PendingAdvance = apps.get_model("characters", "PendingAdvance")
    for char in Character.objects.all().iterator():
        clocks = dict(char.xp_clocks or {})
        changed = False
        for track, cap in TRACK_CAPS.items():
            marks = int(clocks.get(track, 0) or 0)
            while marks >= cap:
                marks -= cap
                PendingAdvance.objects.create(
                    character=char,
                    track=track,
                    status="open",
                )
                changed = True
            clocks[track] = marks
        if changed:
            char.xp_clocks = clocks
            char.save(update_fields=["xp_clocks"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0107_userprofile_cool_night_theme"),
        ("characters", "0099_sync_standard_abilities_srd_dev"),
    ]

    operations = [
        migrations.CreateModel(
            name="PendingAdvance",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "track",
                    models.CharField(
                        choices=[
                            ("insight", "Insight"),
                            ("prowess", "Prowess"),
                            ("resolve", "Resolve"),
                            ("heritage", "Heritage"),
                            ("playbook", "Playbook"),
                        ],
                        max_length=16,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "Open"),
                            ("applied", "Applied"),
                            ("redeemed_manual", "Redeemed (manual)"),
                        ],
                        db_index=True,
                        default="open",
                        max_length=32,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("applied_at", models.DateTimeField(blank=True, null=True)),
                (
                    "applied_allocation",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pending_advances",
                        to="characters.characterxpallocation",
                    ),
                ),
                (
                    "character",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pending_advances",
                        to="characters.character",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="pendingadvance",
            index=models.Index(
                fields=["character", "track", "status"],
                name="pending_adv_char_track_status",
            ),
        ),
        migrations.AlterField(
            model_name="character",
            name="secondary_playbook",
            field=models.CharField(
                blank=True,
                choices=[
                    ("STAND", "Stand"),
                    ("HAMON", "Hamon"),
                    ("SPIN", "Spin"),
                ],
                default=None,
                help_text=(
                    "Legacy only (pre–single-playbook). Not a live rules field; "
                    "cross-playbook abilities come from playbook fills. Prefer "
                    "legacy_secondary_playbook naming in docs."
                ),
                max_length=20,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="characterxpallocation",
            name="allocation_type",
            field=models.CharField(
                choices=[
                    ("LEVEL_UP_STAT", "Level up — Stand Coin stat"),
                    ("LEVEL_UP_DOTS", "Level up — action dots"),
                    ("LEVEL_UP_HERITAGE", "Level up — heritage ability"),
                    ("LEVEL_UP_PLAYBOOK_ABILITY", "Level up — playbook ability"),
                    ("LEVEL_UP_ACQUIRE_STAND", "Level up — acquire Stand"),
                    ("MINOR_ADVANCE", "Minor advance — action dot"),
                    ("BUY_HP", "Buy +1 HP with XP"),
                    (
                        "UNLOCK_SECOND_PLAYBOOK",
                        "Unlock second playbook (30 XP)",
                    ),
                    ("REDEEM_PENDING", "Redeem pending advance"),
                ],
                max_length=32,
            ),
        ),
        migrations.RunPython(pin_heritage_base_hp, noop_reverse),
        migrations.RunPython(clear_secondary_playbook, noop_reverse),
        migrations.RunPython(convert_full_tracks_to_pendings, noop_reverse),
        migrations.RunPython(delete_spin_armor_row, noop_reverse),
    ]
