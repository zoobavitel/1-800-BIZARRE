from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Renames a user account.'

    def add_arguments(self, parser):
        parser.add_argument('old_username', type=str, help='The current username.')
        parser.add_argument('new_username', type=str, help='The new username.')

    def handle(self, *args, **options):
        old_username = options['old_username']
        new_username = options['new_username']

        try:
            user = User.objects.get(username=old_username)
            user.username = new_username
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Successfully renamed user {old_username} to {new_username}.'))
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User {old_username} does not exist.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'An error occurred while renaming user {old_username}: {e}'))
