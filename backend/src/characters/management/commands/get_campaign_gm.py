from django.core.management.base import BaseCommand
from characters.models import Campaign

class Command(BaseCommand):
    help = 'Displays the GM of a specified campaign.'

    def add_arguments(self, parser):
        parser.add_argument('campaign_name', type=str, help='The name of the campaign.')

    def handle(self, *args, **options):
        campaign_name = options['campaign_name']

        try:
            campaign = Campaign.objects.get(name=campaign_name)
            gm_username = campaign.gm.username if campaign.gm else "N/A"
            self.stdout.write(self.style.SUCCESS(f'The GM for campaign "{campaign_name}" is: {gm_username}'))
        except Campaign.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Campaign "{campaign_name}" not found.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'An error occurred: {e}'))
