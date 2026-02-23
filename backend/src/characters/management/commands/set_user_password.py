"""
Set a user's password (e.g. to recover admin login).
Usage: python manage.py set_user_password <username> <new_password>
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = "Set a user's password (for recovering admin or any account)."

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username of the account.')
        parser.add_argument('password', type=str, help='New password to set.')

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User "{username}" not found.'))
            self.stdout.write('Run: python manage.py list_users to see usernames.')
            return

        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f'Password updated for user "{username}". You can log in with that username and the new password.'))
