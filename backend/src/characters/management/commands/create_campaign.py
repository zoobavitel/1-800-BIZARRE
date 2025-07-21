
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Campaign

class Command(BaseCommand):
    help = 'Create a new campaign.'

    def add_arguments(self, parser):
        parser.add_argument('name', type=str, help='The name for the new campaign.')
        parser.add_argument('gm_username', type=str, help='The username of the Game Master.')

    def handle(self, *args, **options):
        name = options['name']
        gm_username = options['gm_username']

        try:
            gm = User.objects.get(username=gm_username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User "{gm_username}" does not exist. Please create it first.'))
            return

        if Campaign.objects.filter(name=name).exists():
            self.stdout.write(self.style.WARNING(f'Campaign "{name}" already exists.'))
            return

        Campaign.objects.create(name=name, gm=gm)
        self.stdout.write(self.style.SUCCESS(f'Successfully created campaign "{name}"'))
