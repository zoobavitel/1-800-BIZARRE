from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Deletes the user slickrick_user.'

    def handle(self, *args, **options):
        username = "slickrick_user"

        try:
            user = User.objects.get(username=username)
            user.delete()
            self.stdout.write(self.style.SUCCESS(f'Successfully deleted user: {username}'))
        except User.DoesNotExist:
            self.stdout.write(self.style.WARNING(f'User {username} does not exist.'))
