from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Character

class Command(BaseCommand):
    help = 'Binds Slick Rick to user Pooj and sets password'

    def handle(self, *args, **options):
        username = "Pooj"
        password = "12345678"
        character_id = 17 # Targeting the specific Slick Rick by ID

        # Get or create the user
        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': f'{username}@example.com'}
        )
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Created user: {username}'))
        else:
            # If user already exists, update password
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.WARNING(f'User {username} already exists. Password updated.'))

        # Find the character Slick Rick by ID
        try:
            character = Character.objects.get(id=character_id)
            character.user = user
            character.save()
            self.stdout.write(self.style.SUCCESS(f'Successfully bound character "{character.true_name}" (ID: {character_id}) to user "{username}".'))
        except Character.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Character with ID {character_id} not found.'))