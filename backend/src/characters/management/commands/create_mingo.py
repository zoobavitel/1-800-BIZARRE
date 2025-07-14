from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Character, Campaign, Heritage, Benefit, Detriment, Vice, Ability

class Command(BaseCommand):
    help = 'Create the character Mingo and assign to campaign and user.'

    def handle(self, *args, **options):
        # Get user Monkeysouz18
        try:
            user_monkeysouz18 = User.objects.get(username='Monkeysouz18')
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR('User Monkeysouz18 does not exist. Please create it first.'))
            return

        # Get campaign "A History of Bad Men"
        try:
            campaign = Campaign.objects.get(name='A History of Bad Men')
        except Campaign.DoesNotExist:
            self.stdout.write(self.style.ERROR('Campaign "A History of Bad Men" does not exist. Please create it first.'))
            return

        # Create or get heritage "Rock Human"
        heritage, _ = Heritage.objects.get_or_create(
            name='Rock Human',
            defaults={'base_hp': 0, 'description': 'A human made of rock.'}
        )

        # Create benefits for Rock Human
        sediment_body, _ = Benefit.objects.get_or_create(
            heritage=heritage,
            name='Sediment Body',
            defaults={'hp_cost': 1, 'description': 'Can reshape into stone or pebbles, allowing stealth and terrain merging.'}
        )
        hardened_physique, _ = Benefit.objects.get_or_create(
            heritage=heritage,
            name='Hardened Physique',
            defaults={'hp_cost': 2, 'description': 'Gain 1 extra Stand Armor charge per scene.'}
        )
        camouflage, _ = Benefit.objects.get_or_create(
            heritage=heritage,
            name='Camouflage',
            defaults={'hp_cost': 1, 'description': 'If stationary, you can become invisible while merged into stone.'}
        )

        # Create detriments for Rock Human
        sinks_like_a_rock, _ = Detriment.objects.get_or_create(
            heritage=heritage,
            name='Sinks Like a Rock',
            defaults={'hp_value': 1, 'description': 'Cannot swim, cannot float.'}
        )
        slow_regeneration, _ = Detriment.objects.get_or_create(
            heritage=heritage,
            name='Slow Regeneration',
            defaults={'hp_value': 1, 'description': 'Healing clock has +1 additional segment.'}
        )
        cold_brittle, _ = Detriment.objects.get_or_create(
            heritage=heritage,
            name='Cold-Brittle',
            defaults={'hp_value': 1, 'description': 'Freezing temperatures cause you to move at half speed.'}
        )

        # Create or get vice "Drugs"
        vice, _ = Vice.objects.get_or_create(
            name='Drugs',
            defaults={'description': 'Indulges in drugs.'}
        )

        # Create abilities
        harmonic_havoc, _ = Ability.objects.get_or_create(
            name='Harmonic Havoc',
            defaults={
                'type': 'other',
                'description': 'Use 1: Able to redirect velocity of objects or effect back to the point of origin. Use 2: Able to play a note and give a teammate(s) an extra 1d6 to attack or resistance rolls. Use 3: Able to elongate/scale inorganic entities up to stand Range.'
            }
        )
        uno_reverse, _ = Ability.objects.get_or_create(
            name='Uno Reverse',
            defaults={
                'type': 'other',
                'description': 'Use 1: Able to make copies of a reflected projectile & reflect them to other opponents. Use 2: Able to roll to regain stress mid battle using finesse or bizarre.'
            }
        )
        resolve_overdrive, _ = Ability.objects.get_or_create(
            name='Resolve Overdrive',
            defaults={'type': 'standard', 'description': 'When you\'re at 3 stress or higher, take +1d to all Stand-related actions'}
        )
        venomous, _ = Ability.objects.get_or_create(
            name='Venomous',
            defaults={'type': 'standard', 'description': 'Choose a drug or poison (from your bandolier stock) to which you have become immune. You can push yourself to secrete it through your skin or saliva or exhale it as a vapor. (Magic Mushrooms in the form of spores)'}
        )
        # Add a generic standard ability to meet the A-rank requirement (1 A-rank = 2 extra abilities, so 3 initial + 2 = 5 total)
        generic_ability, _ = Ability.objects.get_or_create(
            name='Generic Standard Ability',
            defaults={'type': 'standard', 'description': 'A generic standard ability for validation.'}
        )

        # Create character "Mingo"
        character, created = Character.objects.get_or_create(
            true_name='Mingo',
            defaults={
                'user': user_monkeysouz18,
                'campaign': campaign,
                'alias': 'Mingo',
                'level': 5,
                'heritage': heritage,
                'vice': vice,
                'playbook': 'STAND',
                'stand_name': 'Harmonic Havoc',
                'action_dots': {
                    'insight': {'hunt': 0, 'study': 0, 'survey': 1, 'tinker': 0},
                    'prowess': {'finesse': 2, 'prowl': 2, 'skirmish': 0, 'wreck': 0},
                    'resolve': {'bizarre': 2, 'command': 0, 'consort': 0, 'sway': 0}
                },
                'coin_stats': {
                    'power': 'F',
                    'speed': 'B',
                    'precision': 'B',
                    'durability': 'F',
                    'range': 'A',
                    'development': 'D'
                },
                'stress': 3,
                'total_xp_spent': 40, # For Level 5 (1 + 40//10 = 5)
                'background_note': 'Rock Human',
                'close_friend': 'Mother Nature',
                'rival': 'Big Pharma',
                'vice_details': 'Lil guy on head',
            }
        )

        if created:
            character.selected_benefits.add(sediment_body, hardened_physique, camouflage)
            character.selected_detriments.add(sinks_like_a_rock, slow_regeneration, cold_brittle)
            character.standard_abilities.add(harmonic_havoc, uno_reverse, resolve_overdrive, venomous, generic_ability)
            character.save()
            self.stdout.write(self.style.SUCCESS('Successfully created character "Mingo"'))
        else:
            self.stdout.write(self.style.WARNING('Character "Mingo" already exists.'))