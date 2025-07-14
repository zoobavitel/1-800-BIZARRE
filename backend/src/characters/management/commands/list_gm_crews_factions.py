from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Campaign, Crew, Faction

class Command(BaseCommand):
    help = 'Lists all crews and factions for campaigns run by a specific GM.'

    def handle(self, *args, **options):
        gm_username = "zoob"

        try:
            gm_user = User.objects.get(username=gm_username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'GM user "{gm_username}" not found.'))
            return

        campaigns = Campaign.objects.filter(gm=gm_user)

        if not campaigns.exists():
            self.stdout.write(self.style.WARNING(f'No campaigns found for GM "{gm_username}".'))
            return

        self.stdout.write(self.style.SUCCESS(f'Crews and Factions for campaigns run by {gm_username}:'))
        found_any = False

        for campaign in campaigns:
            self.stdout.write(self.style.NOTICE(f'\n--- Campaign: {campaign.name} ---'))
            
            # List Crews
            crews = Crew.objects.filter(campaign=campaign)
            if crews.exists():
                self.stdout.write(self.style.HTTP_INFO('  Crews:'))
                for crew in crews:
                    self.stdout.write(f'    - {crew.name}')
                found_any = True
            else:
                self.stdout.write('  No crews found.')

            # List Factions
            factions = Faction.objects.filter(campaign=campaign)
            if factions.exists():
                self.stdout.write(self.style.HTTP_INFO('  Factions:'))
                for faction in factions:
                    self.stdout.write(f'    - {faction.name} ({faction.get_faction_type_display()})')
                found_any = True
            else:
                self.stdout.write('  No factions found.')
        
        if not found_any:
            self.stdout.write(self.style.WARNING('No crews or factions found for any campaigns run by this GM.'))