from django.core.management.base import BaseCommand
from characters.models import Character

class Command(BaseCommand):
    help = 'Lists all characters named Slick Rick and their associated users.'

    def handle(self, *args, **options):
        slick_ricks = Character.objects.filter(true_name='Slick Rick')

        if not slick_ricks.exists():
            self.stdout.write(self.style.WARNING('No characters named "Slick Rick" found.'))
            return

        self.stdout.write(self.style.SUCCESS('Found the following characters named "Slick Rick":'))
        for sr in slick_ricks:
            user_info = sr.user.username if sr.user else "No user assigned"
            self.stdout.write(f'- ID: {sr.id}, User: {user_info}')
