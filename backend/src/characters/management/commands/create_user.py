
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Create a new user.'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='The username for the new user.')
        parser.add_argument('password', type=str, help='The password for the new user.')
        parser.add_argument('--email', type=str, help='The email for the new user.', default='')

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        email = options['email']

        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.WARNING(f'User "{username}" already exists.'))
            return

        User.objects.create_user(username=username, password=password, email=email)
        self.stdout.write(self.style.SUCCESS(f'Successfully created user "{username}"'))
