from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Deletes specified user accounts.'

    def add_arguments(self, parser):
        parser.add_argument(
            'usernames',
            nargs='+',
            type=str,
            help='List of usernames to delete'
        )

    def handle(self, *args, **options):
        usernames_to_delete = options['usernames']

        for username in usernames_to_delete:
            try:
                user = User.objects.get(username=username)
                user.delete()
                self.stdout.write(self.style.SUCCESS(f'Successfully deleted user: {username}'))
            except User.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'User {username} does not exist.'))
