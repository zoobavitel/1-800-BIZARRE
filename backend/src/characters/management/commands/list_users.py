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
            flags = []
            if user.is_superuser:
                flags.append('superuser')
            if user.is_staff:
                flags.append('staff')
            suffix = f'  ({", ".join(flags)})' if flags else ''
            self.stdout.write(f'  {user.username}{suffix}')
        self.stdout.write('')
        self.stdout.write('To reset a password: python manage.py set_user_password <username> <new_password>')
