"""Verify fold(chargen_baseline, allocations) against live character sheets."""

from django.core.management.base import BaseCommand

from characters.models import Character
from characters.services.respec import (
    backfill_playbook_ability_picks,
    ensure_chargen_baseline,
    verify_character_ledger,
)


class Command(BaseCommand):
    help = (
        "Backfill playbook ability picks and verify allocation ledger vs live sheet. "
        "Sets ledger_reconcile_ok; Respec is blocked when False."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--character-id",
            type=int,
            default=None,
            help="Only verify one character id.",
        )
        parser.add_argument(
            "--backfill-picks",
            action="store_true",
            help="Best-effort attach metadata.picked on LEVEL_UP_PLAYBOOK_ABILITY rows.",
        )

    def handle(self, *args, **options):
        qs = Character.objects.all().order_by("id")
        cid = options.get("character_id")
        if cid:
            qs = qs.filter(pk=cid)
        ok_n = 0
        bad_n = 0
        for character in qs.iterator():
            if not character.chargen_baseline:
                ensure_chargen_baseline(character)
                character.refresh_from_db()
            if options.get("backfill_picks"):
                n = backfill_playbook_ability_picks(character)
                if n:
                    self.stdout.write(
                        f"character {character.id}: backfilled {n} playbook pick(s)"
                    )
            ok, diffs = verify_character_ledger(character)
            if ok:
                ok_n += 1
                self.stdout.write(self.style.SUCCESS(f"OK character {character.id}"))
            else:
                bad_n += 1
                self.stdout.write(
                    self.style.ERROR(
                        f"MISMATCH character {character.id} ({character.true_name}): "
                        f"{sorted(diffs.keys())}"
                    )
                )
                for key, pair in diffs.items():
                    self.stdout.write(f"  {key}: fold={pair['fold']!r} live={pair['live']!r}")
        self.stdout.write(
            self.style.NOTICE(f"Done. ok={ok_n} mismatch={bad_n} total={ok_n + bad_n}")
        )
        if bad_n:
            raise SystemExit(1)
