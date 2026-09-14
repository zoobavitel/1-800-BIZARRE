"""chargen_baseline + ledger reconcile fields; backfill from oldest allocation."""

from django.db import migrations, models


def backfill_chargen_baseline(apps, schema_editor):
    Character = apps.get_model("characters", "Character")
    CharacterXPAllocation = apps.get_model("characters", "CharacterXPAllocation")
    CharacterSpinAbility = apps.get_model("characters", "CharacterSpinAbility")
    CharacterHamonAbility = apps.get_model("characters", "CharacterHamonAbility")

    STAND_FIELDS = (
        "power",
        "speed",
        "range",
        "durability",
        "precision",
        "development",
    )

    for character in Character.objects.all().iterator():
        oldest = (
            CharacterXPAllocation.objects.filter(character_id=character.id)
            .order_by("created_at", "id")
            .first()
        )
        if oldest and isinstance(oldest.payload_before, dict) and oldest.payload_before:
            before = dict(oldest.payload_before)
            spin_ids = list(
                CharacterSpinAbility.objects.filter(
                    character_id=character.id, acquired_at_creation=True
                ).values_list("spin_ability_id", flat=True)
            )
            hamon_ids = list(
                CharacterHamonAbility.objects.filter(
                    character_id=character.id, acquired_at_creation=True
                ).values_list("hamon_ability_id", flat=True)
            )
            # Prefer payload_before ability ids when present; else creation-flagged M2M.
            baseline = {
                "action_dots": dict(before.get("action_dots") or {}),
                "coin_stats": dict(before.get("coin_stats") or {}),
                "standard_ability_ids": list(
                    before.get("standard_ability_ids") or []
                ),
                "spin_ability_ids": [int(x) for x in spin_ids],
                "hamon_ability_ids": [int(x) for x in hamon_ids],
                "extra_custom_abilities": list(
                    before.get("extra_custom_abilities")
                    or getattr(character, "extra_custom_abilities", None)
                    or []
                ),
                "advancement_ability_grants": [],
                "selected_benefit_ids": [],
                "selected_detriment_ids": [],
                "bonus_hp_from_xp": 0,
                "stand_coin_points_gained": 0,
                "action_dice_gained": 0,
                "heritage_points_gained": 0,
                "total_xp_spent": 0,
            }
            for f in STAND_FIELDS:
                baseline["coin_stats"].setdefault(f, "D")
            character.chargen_baseline = baseline
            character.save(update_fields=["chargen_baseline"])
        elif not character.chargen_baseline:
            # No allocations yet — leave empty; ensure_chargen_baseline fills on first spend.
            pass


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0115_merge_20260911_2236"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="chargen_baseline",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    "Frozen sheet snapshot at end of chargen / before first XP allocation. "
                    "Respec rebuilds derived state from this + active allocations."
                ),
            ),
        ),
        migrations.AddField(
            model_name="character",
            name="ledger_reconcile_ok",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "False when fold(chargen_baseline, allocations) disagrees with live sheet. "
                    "Respec mode is blocked until a GM repairs the ledger."
                ),
            ),
        ),
        migrations.AddField(
            model_name="character",
            name="last_respec_commit_token",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Idempotency token for the most recent successful respec-commit.",
                max_length=64,
            ),
        ),
        migrations.RunPython(backfill_chargen_baseline, noop_reverse),
    ]
