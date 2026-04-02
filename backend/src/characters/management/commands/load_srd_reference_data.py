"""
Load SRD benefit/detriment fixtures when those tables are empty.

Production DBs may have heritages (e.g. from migration 0032) but never ran loaddata
for benefits/detriments — the character sheet then shows empty pick lists per heritage.

Safe to run multiple times: skips fixtures that would overwrite existing rows.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand

from characters.models import Benefit, Detriment


class Command(BaseCommand):
    help = "Load srd_benefits / srd_detriments fixtures if the tables are empty."

    def handle(self, *args, **options):
        if not Benefit.objects.exists():
            call_command("loaddata", "srd_benefits", verbosity=1)
            self.stdout.write(self.style.SUCCESS("Loaded fixture: srd_benefits"))
        else:
            self.stdout.write(
                "Skipping srd_benefits (Benefit rows already exist). "
                "Clear benefits in admin only if you intend to reload from fixtures."
            )

        if not Detriment.objects.exists():
            call_command("loaddata", "srd_detriments", verbosity=1)
            self.stdout.write(self.style.SUCCESS("Loaded fixture: srd_detriments"))
        else:
            self.stdout.write(
                "Skipping srd_detriments (Detriment rows already exist). "
                "Clear detriments in admin only if you intend to reload from fixtures."
            )
