from django.core.management.base import BaseCommand
from characters.models import Campaign, Faction

class Command(BaseCommand):
    help = 'Moves specified factions to a new campaign.'

    def handle(self, *args, **options):
        source_campaign_name = "New York State of Mind"
        target_campaign_name = "A History of Bad Men"

        factions_to_move_names = [
            "MADVILLAINY",
            "The Joestars",
            "The Pillarmen",
            "MAESTRO Inc.",
            "Speedwagon Security",
        ]

        try:
            source_campaign = Campaign.objects.get(name=source_campaign_name)
            target_campaign = Campaign.objects.get(name=target_campaign_name)
        except Campaign.DoesNotExist as e:
            self.stdout.write(self.style.ERROR(f'Campaign not found: {e}'))
            return

        self.stdout.write(self.style.SUCCESS(f'Attempting to move factions from "{source_campaign_name}" to "{target_campaign_name}".'))

        for faction_name in factions_to_move_names:
            try:
                faction = Faction.objects.get(campaign=source_campaign, name=faction_name)
                faction.campaign = target_campaign
                faction.save()
                self.stdout.write(self.style.SUCCESS(f'Successfully moved faction: {faction_name}'))
            except Faction.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'Faction "{faction_name}" not found in "{source_campaign_name}". Skipping.'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'An error occurred while moving faction {faction_name}: {e}'))

        self.stdout.write(self.style.SUCCESS('Faction transfer process complete.'))
