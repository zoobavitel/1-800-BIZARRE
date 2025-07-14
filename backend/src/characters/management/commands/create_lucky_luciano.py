from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Character, Campaign, Heritage, Vice, Ability

class Command(BaseCommand):
    help = 'Create the character Lucky Luciano and assign to campaign and user.'

    def handle(self, *args, **options):
        # Get user Monkeysouz18
        try:
            user_monkeysouz18 = User.objects.get(username='Monkeysouz18')
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR('User Monkeysouz18 does not exist. Please create it first.'))
            return

        # Get campaign "New York State of Mind"
        try:
            campaign = Campaign.objects.get(name='New York State of Mind')
        except Campaign.DoesNotExist:
            self.stdout.write(self.style.ERROR('Campaign "New York State of Mind" does not exist. Please create it first.'))
            return

        # Create or get heritage "Human"
        heritage, _ = Heritage.objects.get_or_create(
            name='Human',
            defaults={'base_hp': 0, 'description': 'A standard human heritage'}
        )

        # Create or get vice "Gambling and Smoking"
        vice, _ = Vice.objects.get_or_create(
            name='Gambling and Smoking',
            defaults={'description': 'Indulges in gambling and smoking.'}
        )

        # Create abilities
        pocketful_of_sunshine_ability, _ = Ability.objects.get_or_create(
            name='Pocketful of Sunshine',
            defaults={
                'type': 'other',
                'description': 'Pocketful of Sunshine can create a random item by pulling the lever. This item can be used for the remainder of the scene. This ability works within 40ft of the stand causing the items to revert outside the range. When used, the tangible items and intangible effects have the properties of the stand coin stats and are constrained by Power A, Speed F, Durability C, Precision C, Range D. The user may expend special armor to double their operating range. The user can also use a stress cost of 2 stress to add 1d to roll; however, the user can only use special armor once per scene and must refresh this special armor during downtime. The user can use 2 stress to push themselves once per roll. The user can use PRECISION to roll for items or sensations: 1-3 minor sensation/visuals that can’t cause damage, 4-5 mild sensation/visuals that can harm (level 3 harm); 6 is crippling sensation/visuals (level 4 harm).'
            }
        )
        let_it_rip, _ = Ability.objects.get_or_create(
            name='Let it Rip',
            defaults={'type': 'standard', 'description': 'Roll Precision + Action for random generation: 1-3: Harmless item/sensation. 4-5: Harmful effect (Level 3). 6: Critical effect (Level 4).'}
        )
        coin_god, _ = Ability.objects.get_or_create(
            name='Coin God',
            defaults={'type': 'standard', 'description': 'Flip coin for +1d (Bizarre Action). Detect Stand users.'}
        )
        keen_mind, _ = Ability.objects.get_or_create(
            name='Keen Mind',
            defaults={'type': 'standard', 'description': 'Keen Mind'}
        )
        resolve_overdrive, _ = Ability.objects.get_or_create(
            name='Resolve Overdrive',
            defaults={'type': 'standard', 'description': 'When you\'re at 3 stress or higher, take +1d to all Stand-related actions'}
        )

        # Create character "Luciano “Lucky” Greco"
        character, created = Character.objects.get_or_create(
            true_name='Luciano “Lucky” Greco',
            defaults={
                'user': user_monkeysouz18,
                'campaign': campaign,
                'alias': 'Lucky Luciano',
                'level': 1,
                'heritage': heritage,
                'vice': vice,
                'playbook': 'STAND',
                'stand_name': 'Pocketful of Sunshine',
                'action_dots': {
                    'insight': {'hunt': 1, 'study': 0, 'survey': 1, 'tinker': 0},
                    'prowess': {'finesse': 2, 'prowl': 1, 'skirmish': 0, 'wreck': 0},
                    'resolve': {'bizarre': 0, 'command': 0, 'consort': 0, 'sway': 2} # Adjusted Sway to 2
                },
                'coin_stats': {
                    'power': 'B', # Adjusted Power to B
                    'speed': 'F',
                    'precision': 'C',
                    'range': 'C',
                    'durability': 'C',
                    'development': 'D'
                },
                'stress': 10, # Adjusted stress to 10 for Durability C
                'total_xp_spent': 0,
                'background_note': 'Took up job at 1-800-BIZARRE for cash; chased by debt collectors from The Casino',
                'close_friend': 'The gang',
                'rival': 'The Casino',
                'inventory': [
                    {'name': 'Trumps wallet with ID and credit card', 'quantity': 1},
                    {'name': 'Backpack with basic items like change of cloths, toiletries, and some snacks', 'quantity': 1},
                    {'name': 'Switchblade', 'quantity': 1}
                ],
            }
        )

        if created:
            character.standard_abilities.add(let_it_rip, coin_god, keen_mind)
            character.save()
            self.stdout.write(self.style.SUCCESS('Successfully created character "Luciano “Lucky” Greco"'))
        else:
            self.stdout.write(self.style.WARNING('Character "Luciano “Lucky” Greco" already exists.'))
