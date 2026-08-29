# Hamon playbooks collapse to Caesar / Cyber / Vampiric Style and the Spin catalog
# is trimmed to the SRD rewrite. Rows outside the canonical lists below are removed
# (cascading to the character junction tables) so stale catalog entries stop showing
# up in ability pickers.

from django.db import migrations, models

_LEGACY_HAMON_TYPES = [
    "TRADITIONALIST",
    "ADAPTIVE_FLOW",
    "CYBER_HAMONIST",
    "DARK_RESONANCE",
    "BIO_HARMONICS",
]

_ARCHETYPE_REMAP = {
    "ADAPTIVE_FLOW": "CAESAR_STYLE",
    "CYBER_HAMONIST": "CYBER_STYLE",
    "DARK_RESONANCE": "VAMPIRIC_STYLE",
}

_CANONICAL_HAMON_NAMES = [
    "Ripple Breathing",
    "Ripple Infusion",
    "Scarlet Overdrive",
    "Zoom Punch",
    "Acrobatic Pulse",
    "Vital Transfer",
    "Ripple Hypnosis",
    "Ripple Deflect",
    "Ripple Locator",
    "Sendō Overdrive",
    "Metal Silver Overdrive",
    "Age Resistance",
    "Life Magnetism Overdrive",
    "Tornado Overdrive",
    "Aura Lock",
    "Final Flame",
    "Pulse Detonation",
    "Ripple Cutter",
    "Sunlight Yellow Overdrive",
    "Deep Pass Overdrive",
    "Turquoise Blue Overdrive",
    "Time Ripple",
    "Guided Overdrive",
    "Bubble Launcher",
    "Reflection Pulse",
    "Hamon Mirage",
    "Bubble Laser Grid",
    "Trick Bubble",
    "Echo Feint",
    "Pulse Core",
    "Neural Sync",
    "Shockline",
    "EMP Burst",
    "Circuit Burn",
    "Thermal Control",
    "Blood Freeze",
    "Shadow Pulse",
    "Frozen Fate",
    "Grave Pulse",
    "Aura Extinguish",
    "Soul Leech",
]

_CANONICAL_SPIN_NAMES = [
    "Spin Armor",
    "Golden Arc",
    "Vibrational Scan",
    "Kinetic Tether",
    "Throw Voice",
    "Centripetal Force",
    "Detour",
    "Tendon Manipulation",
    "Stagnant Space",
    "Miracle Shot",
    "Remote Connection",
    "Privileged Pilot",
    "Kinetic Knockdown",
    "Gravitic Leap",
    "Stirrup Surge",
    "Spiral Stampede",
    "Overload Hit",
    "Line Cutter",
    "Civil Engineer",
    "Devastation Chain",
    "Shotgun Scatter",
    "Cosmetic Reconstruction",
    "Spin Suture",
    "Precision Incision",
    "Triage Sphere",
    "Spinfield Stabilizer",
    "Emergency Fusion",
    "Dismantle Strike",
    "Spin Fakeout",
    "Magnetic Pulse",
    "Fracture Intent",
    "Jammer Spiral",
    "Stand Stagger",
    "Spin Muzzle",
    "Cascading Spin",
]


def prune_legacy_catalog_rows(apps, schema_editor):
    HamonAbility = apps.get_model("characters", "HamonAbility")
    SpinAbility = apps.get_model("characters", "SpinAbility")
    Character = apps.get_model("characters", "Character")

    HamonAbility.objects.exclude(name__in=_CANONICAL_HAMON_NAMES).delete()
    HamonAbility.objects.filter(hamon_type__in=_LEGACY_HAMON_TYPES).delete()
    SpinAbility.objects.exclude(name__in=_CANONICAL_SPIN_NAMES).delete()

    for character in Character.objects.only("id", "playbook_xp_archetypes"):
        raw = character.playbook_xp_archetypes
        if not isinstance(raw, list) or not raw:
            continue
        remapped = []
        for key in raw:
            new_key = _ARCHETYPE_REMAP.get(str(key).upper(), str(key).upper())
            if new_key in _LEGACY_HAMON_TYPES or new_key in remapped:
                continue
            remapped.append(new_key)
        if remapped != raw:
            character.playbook_xp_archetypes = remapped
            character.save(update_fields=["playbook_xp_archetypes"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0093_merge_20260820_0720"),
    ]

    operations = [
        migrations.AlterField(
            model_name="hamonability",
            name="hamon_type",
            field=models.CharField(
                choices=[
                    ("FOUNDATION", "Ripple Foundations"),
                    ("CAESAR_STYLE", "Caesar Style"),
                    ("CYBER_STYLE", "Cyber Style"),
                    ("VAMPIRIC_STYLE", "Vampiric Style"),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="hamonability",
            name="required_a_count",
            field=models.IntegerField(
                default=0,
                help_text="Minimum character level required (0 for Ripple Foundations)",
            ),
        ),
        migrations.AlterField(
            model_name="spinability",
            name="required_a_count",
            field=models.IntegerField(
                default=0,
                help_text="Minimum character level required (0 for Spin Foundations)",
            ),
        ),
        migrations.RunPython(prune_legacy_catalog_rows, noop),
    ]
