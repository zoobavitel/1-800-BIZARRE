
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Campaign

class Command(BaseCommand):
    help = 'Update the GM of a campaign.'

    def add_arguments(self, parser):
        parser.add_argument('campaign_name', type=str, help='The name of the campaign to update.')
        parser.add_argument('new_gm_username', type=str, help='The username of the new Game Master.')

    def handle(self, *args, **options):
        campaign_name = options['campaign_name']
        new_gm_username = options['new_gm_username']

        try:
            campaign = Campaign.objects.get(name=campaign_name)
        except Campaign.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Campaign "{campaign_name}" does not exist.'))
            return

        try:
            new_gm = User.objects.get(username=new_gm_username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User "{new_gm_username}" does not exist.'))
            return

        campaign.gm = new_gm
        campaign.save()
        self.stdout.write(self.style.SUCCESS(f'Successfully updated GM of "{campaign_name}" to "{new_gm_username}".'))
