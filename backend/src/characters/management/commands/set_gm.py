from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Campaign


class Command(BaseCommand):
    help = 'Set a specific user as GM for all campaigns'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='zoob',
            help='Username to set as GM for all campaigns (default: zoob)'
        )

    def handle(self, *args, **options):
        username = options['username']
        
        try:
            gm_user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'User "{username}" does not exist.')
            )
            return

        campaigns = Campaign.objects.all()
        if not campaigns.exists():
            self.stdout.write(
                self.style.WARNING('No campaigns found in the database.')
            )
            return

        updated_count = 0
        for campaign in campaigns:
            old_gm = campaign.gm
            campaign.gm = gm_user
            campaign.save()
            updated_count += 1
            
            self.stdout.write(
                f'Updated campaign "{campaign.name}": GM changed from "{old_gm.username if old_gm else "None"}" to "{gm_user.username}"'
            )

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully updated {updated_count} campaign(s). User "{username}" is now GM for all campaigns.'
            )
        )
