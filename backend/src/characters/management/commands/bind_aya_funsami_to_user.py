from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Character

class Command(BaseCommand):
    help = 'Binds Aya Funsami to user cnl_02 and sets password'

    def handle(self, *args, **options):
        username = "cnl_02"
        password = "12345678"
        character_name = "Aya Funsami"

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

        # Find the character Aya Funsami
        try:
            character = Character.objects.get(true_name=character_name)
            character.user = user
            character.save()
            self.stdout.write(self.style.SUCCESS(f'Successfully bound character "{character_name}" to user "{username}".'))
        except Character.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Character "{character_name}" not found.'))
