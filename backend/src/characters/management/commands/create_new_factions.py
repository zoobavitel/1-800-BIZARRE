from django.core.management.base import BaseCommand
from characters.models import Campaign, Faction, User

class Command(BaseCommand):
    help = 'Creates new factions for the "New York State of Mind" campaign.'

    def handle(self, *args, **options):
        campaign_name = "New York State of Mind"
        gm_username = "Pooj"

        try:
            gm_user = User.objects.get(username=gm_username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'GM user "{gm_username}" not found.'))
            return

        try:
            campaign = Campaign.objects.get(name=campaign_name)
        except Campaign.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Campaign "{campaign_name}" not found. Creating it now.'))
            campaign, _ = Campaign.objects.get_or_create(name=campaign_name, defaults={'gm': gm_user})

        factions_to_create = [
            {"name": "MADVILLAINY", "faction_type": "CRIMINAL"},
            {"name": "The Joestars", "faction_type": "NOBLE"},
            {"name": "The Pillarmen", "faction_type": "OTHER"},
            {"name": "MAESTRO Inc.", "faction_type": "MERCHANT"},
            {"name": "Speedwagon Security", "faction_type": "POLITICAL"},
        ]

        for faction_data in factions_to_create:
            faction, created = Faction.objects.get_or_create(
                campaign=campaign,
                name=faction_data["name"],
                defaults={'faction_type': faction_data["faction_type"]}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created faction: {faction.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Faction {faction.name} already exists.'))
