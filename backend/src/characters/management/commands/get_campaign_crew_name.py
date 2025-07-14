from django.core.management.base import BaseCommand
from characters.models import Campaign, Crew

class Command(BaseCommand):
    help = 'Displays the crew name for a given campaign.'

    def handle(self, *args, **options):
        campaign_name = "A History of Bad Men"

        try:
            campaign = Campaign.objects.get(name=campaign_name)
            crews = campaign.crews.all()

            if crews.exists():
                for crew in crews:
                    self.stdout.write(self.style.SUCCESS(f'Crew Name for "{campaign_name}": {crew.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'No crew found for campaign "{campaign_name}".'))

        except Campaign.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Campaign "{campaign_name}" not found.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'An error occurred: {e}'))
