
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Campaign, Crew, Character

class Command(BaseCommand):
    help = 'Create a new crew and add members to it.'

    def add_arguments(self, parser):
        parser.add_argument('crew_name', type=str, help='The name for the new crew.')
        parser.add_argument('campaign_name', type=str, help='The name of the campaign the crew belongs to.')
        parser.add_argument('character_names', nargs='+', type=str, help='The names of the characters to add to the crew.')

    def handle(self, *args, **options):
        crew_name = options['crew_name']
        campaign_name = options['campaign_name']
        character_names = options['character_names']

        try:
            campaign = Campaign.objects.get(name=campaign_name)
        except Campaign.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Campaign "{campaign_name}" does not exist.'))
            return

        crew, created = Crew.objects.get_or_create(
            name=crew_name,
            campaign=campaign,
            defaults={'description': f'The {crew_name} crew.'}
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f'Successfully created crew "{crew_name}"'))
        else:
            self.stdout.write(self.style.WARNING(f'Crew "{crew_name}" already exists.'))

        for character_name in character_names:
            try:
                character = Character.objects.get(true_name=character_name)
                character.crew = crew
                character.save()
                self.stdout.write(self.style.SUCCESS(f'Successfully added "{character_name}" to "{crew_name}"'))
            except Character.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'Character "{character_name}" does not exist.'))
