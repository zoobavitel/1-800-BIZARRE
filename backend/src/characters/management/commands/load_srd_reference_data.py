"""
Load SRD reference fixtures when catalog tables are empty.

Production DBs may have heritages (e.g. from migration 0032) but never ran loaddata
for benefits/detriments or playbook abilities — the character sheet then shows empty lists.

Safe to run multiple times: skips tables that already have rows.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand

from characters.models import Ability, Benefit, Detriment, HamonAbility, SpinAbility


class Command(BaseCommand):
    help = (
        "Load srd_benefits, srd_detriments, standard_abilities, "
        "srd_hamon_abilities, srd_spin_abilities if empty."
    )

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

        if not Ability.objects.exists():
            call_command("loaddata", "standard_abilities", verbosity=1)
            self.stdout.write(self.style.SUCCESS("Loaded fixture: standard_abilities"))
        else:
            self.stdout.write("Skipping standard_abilities (Ability rows already exist).")

        if not HamonAbility.objects.exists():
            call_command("loaddata", "srd_hamon_abilities", verbosity=1)
            self.stdout.write(self.style.SUCCESS("Loaded fixture: srd_hamon_abilities"))
        else:
            self.stdout.write("Skipping srd_hamon_abilities (rows already exist).")

        if not SpinAbility.objects.exists():
            call_command("loaddata", "srd_spin_abilities", verbosity=1)
            self.stdout.write(self.style.SUCCESS("Loaded fixture: srd_spin_abilities"))
        else:
            self.stdout.write("Skipping srd_spin_abilities (rows already exist).")
