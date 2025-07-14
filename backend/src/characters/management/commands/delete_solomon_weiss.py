from django.core.management.base import BaseCommand
from characters.models import Character

class Command(BaseCommand):
    help = 'Deletes the character Solomon Weiss.'

    def handle(self, *args, **options):
        try:
            character = Character.objects.get(true_name='Solomon Weiss')
            character.delete()
            self.stdout.write(self.style.SUCCESS('Successfully deleted Solomon Weiss'))
        except Character.DoesNotExist:
            self.stdout.write(self.style.WARNING('Character Solomon Weiss not found.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'An error occurred: {e}'))
