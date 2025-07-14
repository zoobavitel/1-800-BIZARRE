from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Character, Campaign

class Command(BaseCommand):
    help = 'Assigns Aya Funsami to a campaign and lists all characters in it.'

    def handle(self, *args, **options):
        character_name = "Aya Funsami"
        campaign_name = "A History of Bad Men"
        gm_username = "cnl_02" # Assuming the user who created Aya Funsami is the GM

        try:
            # Get the GM user
            gm_user = User.objects.get(username=gm_username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'GM user "{gm_username}" not found. Please create it first.'))
            return

        # Get or create the campaign
        campaign, created = Campaign.objects.get_or_create(
            name=campaign_name,
            defaults={'gm': gm_user, 'description': 'A campaign about bad men.'}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created campaign: {campaign_name}'))
        else:
            self.stdout.write(self.style.WARNING(f'Using existing campaign: {campaign_name}'))

        # Assign Aya Funsami to the campaign
        try:
            aya_funsami = Character.objects.get(true_name=character_name)
            if aya_funsami.campaign != campaign:
                aya_funsami.campaign = campaign
                aya_funsami.save()
                self.stdout.write(self.style.SUCCESS(f'Assigned {character_name} to campaign "{campaign_name}".'))
            else:
                self.stdout.write(self.style.WARNING(f'{character_name} is already in campaign "{campaign_name}".'))
        except Character.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Character "{character_name}" not found.'))
            return

        self.stdout.write(self.style.SUCCESS(f'\nCharacters in "{campaign_name}":'))
        for char in campaign.characters.all():
            self.stdout.write(f'- {char.true_name} (Player: {char.user.username})')
