from django.core.management.base import BaseCommand
from characters.models import Character

class Command(BaseCommand):
    help = "Lists all characters and their associated users."

    def handle(self, *args, **options):
        characters = Character.objects.all()
        if characters.exists():
            self.stdout.write(self.style.SUCCESS("Characters and their Users:"))
            for char in characters:
                user_info = char.user.username if char.user else "No user assigned"
                self.stdout.write(f"- {char.true_name}: {user_info}")
        else:
            self.stdout.write(self.style.WARNING("No characters found in the database."))
