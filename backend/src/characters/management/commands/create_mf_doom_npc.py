from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import NPC, Heritage, Campaign, SpinAbility

class Command(BaseCommand):
    help = 'Create the MF DOOM NPC for testing and demonstration purposes.'

    def handle(self, *args, **options):
        # Ensure a user exists to be the creator
        user, created = User.objects.get_or_create(
            username='admin',
            defaults={'email': 'admin@example.com', 'is_staff': True, 'is_superuser': True}
        )
        if created:
            user.set_password('admin')
            user.save()
            self.stdout.write(self.style.SUCCESS('Created admin user.'))
        else:
            self.stdout.write(self.style.WARNING('Using existing admin user.'))

        # Ensure a Heritage exists
        heritage, created = Heritage.objects.get_or_create(
            name='Human',
            defaults={'base_hp': 0, 'description': 'A standard human heritage'}
        )
        if created:
            self.stdout.write(self.style.SUCCESS('Created Human Heritage.'))
        else:
            self.stdout.write(self.style.WARNING('Using existing Human Heritage.'))

        # Ensure a Campaign exists (optional, but good for testing)
        campaign, created = Campaign.objects.get_or_create(
            name='Test Campaign',
            defaults={'gm': user, 'description': 'A campaign for testing NPCs.'}
        )
        if created:
            campaign.players.add(user)
            self.stdout.write(self.style.SUCCESS('Created Test Campaign.'))
        else:
            self.stdout.write(self.style.WARNING('Using existing Test Campaign.'))

        # Create Spin Abilities if they don't exist
        spin_abilities_data = [
            {'name': 'Spin Foundation', 'spin_type': 'FOUNDATION', 'description': 'Basic Spin techniques', 'stress_cost': 0, 'frequency': ''},
            {'name': 'Cavalier Spin', 'spin_type': 'CAVALIER', 'description': 'Advanced Spin combat techniques', 'stress_cost': 1, 'frequency': 'Once per scene'},
            {'name': 'Architect Spin', 'spin_type': 'ARCHITECT', 'description': 'Spin construction and manipulation', 'stress_cost': 2, 'frequency': 'Once per score'},
        ]
        for data in spin_abilities_data:
            SpinAbility.objects.get_or_create(name=data['name'], defaults=data)

        # Get Spin Abilities for MF DOOM
        spin_foundation = SpinAbility.objects.get(name='Spin Foundation')
        cavalier_spin = SpinAbility.objects.get(name='Cavalier Spin')
        architect_spin = SpinAbility.objects.get(name='Architect Spin')

        # Define MF DOOM's Stand Coin Stats (13 points)
        # S=5, A=4, B=3, C=2, D=1, F=0
        # Total points: 5+4+3+1+0+0 = 13
        mf_doom_stand_coin_stats = {
            'POWER': 'S',       # 5 points (Level 4 harm)
            'SPEED': 'A',       # 4 points (Acts before B/C/D/F, 5 actions)
            'DURABILITY': 'B',  # 3 points (8 segments + 3 Special Armor)
            'PRECISION': 'D',   # 1 point (Can target 1 player)
            'RANGE': 'F',       # 0 points (10 feet)
            'POTENTIAL': 'F',   # 0 points (Not a chance)
        }

        # Create MF DOOM NPC
        npc, created = NPC.objects.get_or_create(
            name='MF DOOM',
            defaults={
                'level': 4,
                'appearance': 'A masked villain, often seen in a metal mask and a hoodie.',
                'role': 'Master of Rhyme and Villainy',
                'weakness': 'Can be distracted by rare records or obscure samples.',
                'need': 'To maintain his villainous persona and mystique.',
                'desire': 'To collect all the breaks and samples in the universe.',
                'rumour': 'Some say he has multiple aliases and is never truly in one place.',
                'secret': 'He sometimes helps those in need, but only if it benefits his villainous image.',
                'passion': 'Crafting intricate rhymes and beats.',
                'description': 'The supervillain of the underground, known for his complex lyricism and unique flow.',
                'stand_coin_stats': mf_doom_stand_coin_stats,
                'heritage': heritage,
                'playbook': 'SPIN',
                'custom_abilities': 'Doomsday: Able to write his consciousness into objects imbued with spin.',
                'relationships': {
                    'player_characters': {},
                    'crew': {},
                    'factions': {}
                },
                'harm_clock_current': 0,
                'vulnerability_clock_current': 0,
                'armor_charges': 3, # Initial armor charges
                'creator': user,
                'campaign': campaign,
                'stand_description': 'A manifestation of his lyrical prowess, often appearing as a shadowy, metallic figure.',
                'stand_appearance': 'A metallic, humanoid figure with glowing red eyes, often surrounded by swirling musical notes.',
                'stand_manifestation': 'Manifests through sound waves and vibrations, particularly from his music.',
                'special_traits': 'Can manipulate sound and rhythm to affect the environment and others.'
            }
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f'Successfully created MF DOOM NPC (ID: {npc.id}).'))
        else:
            self.stdout.write(self.style.WARNING(f'MF DOOM NPC already exists (ID: {npc.id}).'))

        # Add Spin abilities to MF DOOM
        # Note: This assumes a many-to-many relationship or similar for custom abilities.
        # For now, custom_abilities is a TextField, so we'll just ensure the SpinAbilities exist.
        # If you want to link them directly, we'd need a ManyToManyField on the NPC model.
        self.stdout.write(self.style.SUCCESS('Ensured Spin abilities exist for MF DOOM.'))
