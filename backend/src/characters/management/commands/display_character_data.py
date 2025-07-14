from django.core.management.base import BaseCommand
from characters.models import Character
import json

class Command(BaseCommand):
    help = 'Displays character data for specified characters.'

    def handle(self, *args, **options):
        characters = Character.objects.all()
        for character in characters:
            self.display_character(character)

    def display_character(self, character):
        self.stdout.write(self.style.SUCCESS(f'\n--- Character: {character.true_name} (ID: {character.id}) ---'))
        self.stdout.write(f'  Player: {character.user.username if character.user else "N/A"}')
        self.stdout.write(f'  Campaign: {character.campaign.name if character.campaign else "N/A"}')
        self.stdout.write(f'  Level: {character.level}')
        self.stdout.write(f'  Playbook: {character.playbook}')
        self.stdout.write(f'  Stand Name: {character.stand_name if character.stand_name else "N/A"}')
        self.stdout.write(f'  Coin Stats: {json.dumps(character.coin_stats, indent=2)}')
        self.stdout.write(f'  Action Dots: {json.dumps(character.action_dots, indent=2)}')
        self.stdout.write(f'  Vice: {character.vice.name if character.vice else "N/A"}')
        self.stdout.write(f'  Heritage: {character.heritage.name if character.heritage else "N/A"}')
        self.stdout.write(f'  Total XP Spent: {character.total_xp_spent}')
        self.stdout.write(f'  XP Clocks: {json.dumps(character.xp_clocks, indent=2)}')
        self.stdout.write(f'  Inventory: {json.dumps(character.inventory, indent=2)}')

        self.stdout.write(self.style.SUCCESS('  Abilities:'))
        for ability in character.standard_abilities.all():
            self.stdout.write(f'    - {ability.name}: {ability.description}')
        
        for spin_ability in character.spin_abilities.all():
            self.stdout.write(f'    - {spin_ability.spin_ability.name}: {spin_ability.spin_ability.description}')