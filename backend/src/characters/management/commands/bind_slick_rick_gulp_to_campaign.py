from django.core.management.base import BaseCommand
from characters.models import Character, Campaign, User

class Command(BaseCommand):
    help = 'Binds Slick Rick (GULP) to the "New York State of Mind" campaign.'

    def handle(self, *args, **options):
        slick_rick_name = "Slick Rick"
        slick_rick_stand_name = "GULP"
        campaign_name = "New York State of Mind"
        gm_username = "Pooj" # Assuming Pooj is the GM for this new campaign

        try:
            # Get the GM user (Pooj)
            gm_user = User.objects.get(username=gm_username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'GM user "{gm_username}" not found. Please create it first.'))
            return

        # Get or create the campaign
        campaign, created = Campaign.objects.get_or_create(
            name=campaign_name,
            defaults={'gm': gm_user, 'description': 'A campaign set in New York.'}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created campaign: {campaign_name}'))
        else:
            self.stdout.write(self.style.WARNING(f'Using existing campaign: {campaign_name}'))

        # Find the specific Slick Rick character
        try:
            slick_rick = Character.objects.get(true_name=slick_rick_name, stand_name=slick_rick_stand_name)
            if slick_rick.campaign != campaign:
                slick_rick.campaign = campaign
                slick_rick.save()
                self.stdout.write(self.style.SUCCESS(f'Assigned {slick_rick_name} (GULP) to campaign "{campaign_name}".'))
            else:
                self.stdout.write(self.style.WARNING(f'{slick_rick_name} (GULP) is already in campaign "{campaign_name}".'))
        except Character.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Character "{slick_rick_name}" with Stand "{slick_rick_stand_name}" not found.'))
        except Character.MultipleObjectsReturned:
            self.stdout.write(self.style.ERROR(f'Multiple characters named "{slick_rick_name}" with Stand "{slick_rick_stand_name}" found. Please specify by ID if necessary.'))
