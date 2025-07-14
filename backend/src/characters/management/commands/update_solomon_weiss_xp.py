from django.core.management.base import BaseCommand
from characters.models import Character

class Command(BaseCommand):
    help = 'Updates the XP and level of Solomon Weiss.'

    def handle(self, *args, **options):
        try:
            character = Character.objects.get(true_name='Solomon Weiss')
            character.level = 5
            character.total_xp_spent = 60
            character.action_dice_gained = 2
            character.stand_coin_points_gained = 5
            character.xp_clocks = {'playbook': 5}
            character.save()
            self.stdout.write(self.style.SUCCESS('Successfully updated Solomon Weiss\'s XP.'))
        except Character.DoesNotExist:
            self.stdout.write(self.style.WARNING('Character Solomon Weiss not found.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'An error occurred: {e}'))
