"""
Create a test account and five Stand playbook example characters from the SRD.

These match the Example Stand Types: Colony, Automatic, Tool-Bound, Fighting Spirit,
and Phenomena. Each has correct Stand Coin stats, flat action_dots (7 total, max 2
per action), and a Stand record so the frontend shows action ratings and stats.

Usage:
  python manage.py create_stand_playbook_test_characters
  python manage.py create_stand_playbook_test_characters --username testuser --password testpass123
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import (
    Character, Heritage, Vice, Ability, Stand, StandAbility, Benefit, Detriment,
)


# SRD: 7 action dots total at creation, max 2 per action. Use flat keys (model expects these).
def flat_action_dots(hunt=0, study=0, survey=0, tinker=0, finesse=0, prowl=0, skirmish=0, wreck=0,
                     bizarre=0, command=0, consort=0, sway=0):
    return {
        'hunt': hunt, 'study': study, 'survey': survey, 'tinker': tinker,
        'finesse': finesse, 'prowl': prowl, 'skirmish': skirmish, 'wreck': wreck,
        'bizarre': bizarre, 'command': command, 'consort': consort, 'sway': sway,
    }


# Stand playbook definitions: name, stand_name, type, coin_stats, stress (from durability), abilities (3 or 5)
PLAYBOOKS = [
    {
        'true_name': '3 Little Birds (Colony)',
        'alias': 'Three Birds',
        'stand_name': '3 Little Birds',
        'stand_type': 'COLONY',
        'coin_stats': {'power': 'D', 'speed': 'D', 'range': 'C', 'durability': 'D', 'precision': 'D', 'development': 'F'},
        'stress': 9,
        'standard_ability_names': ['Shared Vision', 'Cascade Effect', 'Reflexes'],
        'stand_form': 'A swarm of three intelligent birds—each with a unique function.',
        'unique_abilities': [
            ('Cannibal Chain', 'When one bird is defeated or eaten by another bird, it may absorb its ability as a temporary second function. Bird 1 can spit acid and gain +1 armor underground, Bird 2 can spit blinding ink and gain +1 armor underwater, bird 3 gains armor while flying.'),
            ('Tri-Will Split', 'You may issue separate commands to each bird (max 3 targets), but reduce effect by 1 for each split action.'),
        ],
    },
    {
        'true_name': 'Paint It Black (Automatic)',
        'alias': 'Paint It Black',
        'stand_name': 'Paint It Black',
        'stand_type': 'AUTOMATIC',
        'coin_stats': {'power': 'B', 'speed': 'F', 'range': 'D', 'durability': 'D', 'precision': 'F', 'development': 'D'},
        'stress': 9,
        'standard_ability_names': ['Saboteur', 'Bizarre Ward', 'Reflexes'],
        'stand_form': 'A skeleton that hunts hostile heat signatures and leaves corrosive ink behind.',
        'unique_abilities': [
            ('Meltdown Pulse', 'When striking a heat source, melt through armor or terrain as if it were soft.'),
            ('Ink Drift', 'After an explosive action, terrain becomes toxic. Movement through the zone costs 1 stress or requires resistance.'),
        ],
    },
    {
        'true_name': 'Nitro Burnin\' Funny Car (Tool-Bound)',
        'alias': 'Nitro',
        'stand_name': 'Nitro Burnin\' Funny Car',
        'stand_type': 'TOOLBOUND',
        'coin_stats': {'power': 'D', 'speed': 'C', 'range': 'D', 'durability': 'D', 'precision': 'F', 'development': 'D'},
        'stress': 9,
        'standard_ability_names': ['Echo Strikes', 'Bizarre Ward', 'Reflexes'],
        'stand_form': 'A hot rod engine bound to your soul. Supercharge machinery until it burns out.',
        'unique_abilities': [
            ('Overdrive', 'When the user interacts with machinery, you are able to extend the stand coin properties to that machine.'),
            ('Autokill Directive', 'Once per score, name a kill condition (e.g. "when it flees," "when it draws a weapon"). When fulfilled, the Stand auto-triggers an attack, maneuver, or other action.'),
        ],
    },
    {
        'true_name': 'Lethal Injection (Fighting Spirit)',
        'alias': 'Lethal',
        'stand_name': 'Lethal Injection',
        'stand_type': 'FIGHTING',
        'coin_stats': {'power': 'D', 'speed': 'D', 'range': 'D', 'durability': 'D', 'precision': 'D', 'development': 'D'},
        'stress': 9,
        'standard_ability_names': ['Iron Will', 'Steady Barrage', 'Reflexes'],
        'stand_form': 'A humanoid Stand cloaked in elemental fire and ice. Swaps temperature states mid-combat.',
        'unique_abilities': [
            ('Thermic Chain', 'Each attack shifts element. Fire causes lingering burn (half POWER), ice creates "brittle" status (next hit +1 Harm).'),
            ('Blister Swap', 'Once per scene, swap places with your Stand during a resistance roll to ignore 1 level of harm.'),
        ],
    },
    {
        'true_name': 'Dream Baby Dream (Phenomena)',
        'alias': 'Dream Baby',
        'stand_name': 'Dream Baby Dream',
        'stand_type': 'PHENOMENA',
        'coin_stats': {'power': 'F', 'speed': 'F', 'range': 'C', 'durability': 'F', 'precision': 'F', 'development': 'A'},
        'stress': 8,
        'standard_ability_names': ['Bizarre Improvisation', 'Like Looking into a Mirror', 'Bizarre Intuition', 'Foresight', 'Calculating'],
        'stand_form': 'A shared hallucination—a child\'s recurring nightmare with metaphysical weight.',
        'unique_abilities': [
            ('Narrative Override', 'Once per score, describe how a "strange coincidence" saves you from a failed roll.'),
            ('Emotion Veil', 'Project an emotional field. If targets fail to resist, they suffer -1d on their next action due to overwhelming effect.'),
        ],
    },
]


class Command(BaseCommand):
    help = 'Create test user and five SRD Stand playbook example characters with action ratings and Stands'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='testuser',
            help='Username for the test account',
        )
        parser.add_argument(
            '--password',
            type=str,
            default='testpass123',
            help='Password for the test account',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete existing characters for this user before creating',
        )

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        clear = options['clear']

        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': f'{username}@test.example.com'},
        )
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Created test user: {username}'))
        else:
            self.stdout.write(self.style.WARNING(f'Using existing user: {username}'))

        if clear:
            count, _ = Character.objects.filter(user=user).delete()
            if count:
                self.stdout.write(self.style.WARNING(f'Removed {count} existing character(s).'))

        heritage = Heritage.objects.filter(name='Human').first()
        if not heritage:
            heritage = Heritage.objects.create(name='Human', base_hp=0, description='Standard human.')
            self.stdout.write(f'Created heritage: {heritage.name}')

        vice, _ = Vice.objects.get_or_create(
            name='Weird',
            defaults={'description': 'Drawn to the strange and unexplained'},
        )

        for i, pb in enumerate(PLAYBOOKS):
            char = self._create_playbook_character(user, heritage, vice, pb, i)
            self.stdout.write(self.style.SUCCESS(f'Created: {char.true_name} (Stand: {char.stand_name})'))

        self.stdout.write(self.style.SUCCESS(
            f'Done. Log in as {username} / {password} to see the five Stand playbook characters with action ratings.'
        ))

    def _create_playbook_character(self, user, heritage, vice, pb, index):
        # Flat action_dots: 7 total, max 2 per action (SRD). Vary by playbook for flavor.
        action_dots = flat_action_dots(
            hunt=1, study=1, survey=0, tinker=1,
            finesse=1, prowl=0, skirmish=2, wreck=0,
            bizarre=0, command=1, consort=0, sway=0,
        )

        character = Character.objects.create(
            user=user,
            true_name=pb['true_name'],
            alias=pb['alias'],
            appearance=pb.get('stand_form', '')[:200],
            heritage=heritage,
            vice=vice,
            playbook='STAND',
            stand_name=pb['stand_name'],
            stand_type=pb['stand_type'],
            stand_form=pb.get('stand_form', ''),
            stand_conscious=True,
            coin_stats=pb['coin_stats'],
            action_dots=action_dots,
            stress=pb['stress'],
            trauma=[],
            loadout=1,
            background_note=f"SRD Stand playbook example: {pb['stand_type']}.",
            close_friend='',
            rival='',
        )

        # Stand record (OneToOne) so API and frontend get stand stats and validation holds
        cs = pb['coin_stats']
        stand = Stand.objects.create(
            character=character,
            name=pb['stand_name'],
            type=pb['stand_type'],
            form='Humanoid' if pb['stand_type'] != 'PHENOMENA' else 'Phenomenon',
            consciousness_level='C',
            power=cs['power'],
            speed=cs['speed'],
            range=cs['range'],
            durability=cs['durability'],
            precision=cs['precision'],
            development=cs['development'],
            armor=0,
        )

        for ab_name in pb['standard_ability_names']:
            ability, _ = Ability.objects.get_or_create(
                name=ab_name,
                defaults={'type': 'standard', 'description': f'Standard ability: {ab_name}.'},
            )
            character.standard_abilities.add(ability)

        for name, desc in pb['unique_abilities']:
            StandAbility.objects.get_or_create(
                stand=stand,
                name=name,
                defaults={'description': desc},
            )

        return character
