from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Character


class Command(BaseCommand):
    help = "Binds Slick Rick to a player user"

    def handle(self, *args, **options):
        username = "slick_rick_player"
        character_id = 17  # Targeting the specific Slick Rick by ID

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

        # Find the character Slick Rick by ID
        try:
            character = Character.objects.get(id=character_id)
            character.user = user
            character.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully bound character "{character.true_name}" (ID: {character_id}) to user "{username}".'
                )
            )
        except Character.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f"Character with ID {character_id} not found.")
            )
