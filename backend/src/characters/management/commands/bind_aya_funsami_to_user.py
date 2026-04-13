from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Character


class Command(BaseCommand):
    help = "Binds Aya Funsami to a test user"

    def handle(self, *args, **options):
        username = "aya_funsami_player"
        character_name = "Aya Funsami"

        # Get or create the user
        user, created = User.objects.get_or_create(
            username=username, defaults={"email": f"{username}@example.com"}
        )
        if created:
            user.set_password(User.objects.make_random_password())
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created user: {username}"))
        else:
            self.stdout.write(self.style.WARNING(f"User {username} already exists."))

        # Find the character Aya Funsami
        try:
            character = Character.objects.get(true_name=character_name)
            character.user = user
            character.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully bound character "{character_name}" to user "{username}".'
                )
            )
        except Character.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'Character "{character_name}" not found.')
            )
