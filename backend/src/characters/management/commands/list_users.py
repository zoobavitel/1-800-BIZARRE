from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Lists all user accounts in the database.'

    def handle(self, *args, **options):
        users = User.objects.all().order_by('username')
        if not users.exists():
            self.stdout.write(self.style.WARNING('No user accounts found in the database.'))
            return

        self.stdout.write(self.style.SUCCESS('User Accounts:'))
        for user in users:
            self.stdout.write(f'- {user.username}')
