from django.core.management.base import BaseCommand
from characters.models import Campaign, Faction, ProgressClock

class Command(BaseCommand):
    help = 'Displays detailed information for factions in a specified campaign.'

    def handle(self, *args, **options):
        campaign_name = "A History of Bad Men"

        try:
            campaign = Campaign.objects.get(name=campaign_name)
            factions = Faction.objects.filter(campaign=campaign)

            if not factions.exists():
                self.stdout.write(self.style.WARNING(f'No factions found for campaign "{campaign_name}".'))
                return

            self.stdout.write(self.style.SUCCESS(f'\n--- Factions in "{campaign_name}" ---'))

            for faction in factions:
                self.stdout.write(self.style.NOTICE(f'\nFaction Name: {faction.name}'))
                self.stdout.write(f'  Type: {faction.get_faction_type_display()}')
                self.stdout.write(f'  Hold: {faction.hold}')
                self.stdout.write(f'  Reputation (Level): {faction.reputation}')
                self.stdout.write(f'  Notes: {faction.notes if faction.notes else "(None)"}')

                # Check for associated project clocks
                clocks = ProgressClock.objects.filter(faction=faction)
                if clocks.exists():
                    self.stdout.write(self.style.HTTP_INFO('  Associated Progress Clocks:'))
                    for clock in clocks:
                        self.stdout.write(f'    - {clock.name} ({clock.filled_segments}/{clock.max_segments} segments filled, Type: {clock.get_clock_type_display()})')
                        self.stdout.write(f'      Description: {clock.description if clock.description else "(None)"}')
                else:
                    self.stdout.write('  No associated progress clocks.')

        except Campaign.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Campaign "{campaign_name}" not found.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'An error occurred: {e}'))
