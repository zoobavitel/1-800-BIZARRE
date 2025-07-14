from django.core.management.base import BaseCommand
from characters.models import Character

class Command(BaseCommand):
    help = 'Displays XP spent breakdown for a specific character.'

    def handle(self, *args, **options):
        character_id = 15  # Slick Rick (GULP) ID

        try:
            character = Character.objects.get(id=character_id)
            self.stdout.write(self.style.SUCCESS(f'\n--- XP Spent Breakdown for {character.true_name} (ID: {character.id}) ---'))
            self.stdout.write(f'  Total XP Spent: {character.total_xp_spent}')
            self.stdout.write(f'  Heritage Points Gained (5 XP/point): {character.heritage_points_gained}')
            self.stdout.write(f'  Stand Coin Points Gained (10 XP/point): {character.stand_coin_points_gained}')
            self.stdout.write(f'  Action Dice Gained (5 XP/die): {character.action_dice_gained}')

            # Verify the total XP spent matches the sum of advancements
            calculated_xp = (
                character.heritage_points_gained * 5 +
                character.stand_coin_points_gained * 10 +
                character.action_dice_gained * 5
            )
            self.stdout.write(f'  Calculated XP from Advancements: {calculated_xp}')
            if calculated_xp == character.total_xp_spent:
                self.stdout.write(self.style.SUCCESS('  (Calculated XP matches Total XP Spent)'))
            else:
                self.stdout.write(self.style.ERROR('  (WARNING: Calculated XP DOES NOT match Total XP Spent)'))

        except Character.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Character with ID {character_id} not found.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'An error occurred: {e}'))
