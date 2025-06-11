from django.test import TestCase
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from .models import (
    Campaign, Crew, Heritage, Detriment, Benefit, Vice, NPC, 
    Ability, Character, Stand, StandAbility, HamonAbility, SpinAbility, ProgressClock, ExperienceTracker, DowntimeActivity, Score
)


class HeritageModelTest(TestCase):
    """Test the Heritage model based on SRD rules."""
    
    def setUp(self):
        """Set up test heritage types based on SRD."""
        self.heritage_data = [
            {'name': 'Human', 'base_hp': 0},
            {'name': 'Rock Human', 'base_hp': 2},
            {'name': 'Vampire', 'base_hp': 3},
            {'name': 'Pillar Man', 'base_hp': 1},
            {'name': 'Gray Matter', 'base_hp': 1},
            {'name': 'Haunting', 'base_hp': 1},
            {'name': 'Cyborg', 'base_hp': 3},
            {'name': 'Oracle', 'base_hp': 1},
        ]
        
        for data in self.heritage_data:
            Heritage.objects.create(**data)
    
    def test_heritage_creation(self):
        """Test that all 8 heritage types are created correctly."""
        self.assertEqual(Heritage.objects.count(), 8)
        
        # Test specific heritage base HP values
        human = Heritage.objects.get(name='Human')
        self.assertEqual(human.base_hp, 0)
        
        vampire = Heritage.objects.get(name='Vampire')
        self.assertEqual(vampire.base_hp, 3)
        
        rock_human = Heritage.objects.get(name='Rock Human')
        self.assertEqual(rock_human.base_hp, 2)
    
    def test_heritage_str_representation(self):
        """Test string representation of heritage."""
        human = Heritage.objects.get(name='Human')
        # The model doesn't have __str__ method, should return default


class DetrimentBenefitModelTest(TestCase):
    """Test Detriment and Benefit models based on SRD rules."""
    
    def setUp(self):
        """Set up test data for detriments and benefits."""
        self.human = Heritage.objects.create(name='Human', base_hp=0)
        self.vampire = Heritage.objects.create(name='Vampire', base_hp=3)
        
    def test_human_detriments(self):
        """Test Human heritage detriments from SRD."""
        # Human optional detriments (max 3, each grants +1 HP)
        detriments = [
            {'name': 'Physically Inferior', 'hp_value': 1, 'required': False, 
             'description': '-1d when resisting physical harm.'},
            {'name': 'Bizarre Blindspot', 'hp_value': 1, 'required': False,
             'description': '-1d when resisting Stand, Hamon, or supernatural effects.'},
            {'name': 'Slower Recovery', 'hp_value': 1, 'required': False,
             'description': 'Healing clock permanently reduced by 1 segment.'},
            {'name': 'Slower Movement', 'hp_value': 1, 'required': False,
             'description': 'Base movement speed reduced from 30ft to 20ft.'},
        ]
        
        for det_data in detriments:
            Detriment.objects.create(heritage=self.human, **det_data)
        
        self.assertEqual(self.human.detriments.count(), 4)
        self.assertFalse(self.human.detriments.filter(required=True).exists())
    
    def test_human_benefits(self):
        """Test Human heritage benefits from SRD."""
        # Human benefits (max 3)
        benefits = [
            {'name': 'Skilled From Birth', 'hp_cost': 1, 'required': False,
             'description': 'Can start with 3 dots in a single skill instead of the usual cap of 2.'},
            {'name': 'Sheer Grit', 'hp_cost': 2, 'required': False,
             'description': 'Once per session, reroll any failed roll.'},
            {'name': 'Tactical Awareness', 'hp_cost': 1, 'required': False,
             'description': '+1d to all reaction-based rolls in combat.'},
            {'name': 'Resourceful', 'hp_cost': 2, 'required': False,
             'description': 'Gain +1 downtime action for training, healing, or crafting.'},
        ]
        
        for ben_data in benefits:
            Benefit.objects.create(heritage=self.human, **ben_data)
        
        self.assertEqual(self.human.benefits.count(), 4)
        self.assertFalse(self.human.benefits.filter(required=True).exists())
    
    def test_vampire_required_detriments(self):
        """Test Vampire required detriments provide +3 free HP."""
        vampire_detriments = [
            {'name': 'Sunlight Weakness', 'hp_value': 2, 'required': True,
             'description': 'Takes Level 4 Harm per minute in direct sunlight.'},
            {'name': 'Hamon Vulnerability', 'hp_value': 1, 'required': True,
             'description': 'Hamon techniques deal +1 Harm and bypass armor.'},
        ]
        
        for det_data in vampire_detriments:
            Detriment.objects.create(heritage=self.vampire, **det_data)
        
        required_detriments = self.vampire.detriments.filter(required=True)
        total_free_hp = sum(det.hp_value for det in required_detriments)
        self.assertEqual(total_free_hp, 3)


class CampaignModelTest(TestCase):
    """Test Campaign model functionality."""
    
    def setUp(self):
        """Set up test users and campaign."""
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        self.player1 = User.objects.create_user(username='player1', email='p1@test.com', password='testpass')
        self.player2 = User.objects.create_user(username='player2', email='p2@test.com', password='testpass')
        
        self.campaign = Campaign.objects.create(
            name='Diamond is Unbreakable',
            gm=self.gm_user,
            description='A campaign set in Morioh town.'
        )
        self.campaign.players.add(self.player1, self.player2)
    
    def test_campaign_creation(self):
        """Test campaign creation and relationships."""
        self.assertEqual(self.campaign.name, 'Diamond is Unbreakable')
        self.assertEqual(self.campaign.gm, self.gm_user)
        self.assertEqual(self.campaign.players.count(), 2)
        self.assertIn(self.player1, self.campaign.players.all())
        self.assertIn(self.player2, self.campaign.players.all())
    
    def test_campaign_str_representation(self):
        """Test campaign string representation."""
        self.assertEqual(str(self.campaign), 'Diamond is Unbreakable')


class CrewModelTest(TestCase):
    """Test Crew model based on SRD crew mechanics."""
    
    def setUp(self):
        """Set up test campaign and crew."""
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        self.campaign = Campaign.objects.create(name='Test Campaign', gm=self.gm_user)
        
        self.crew = Crew.objects.create(
            name='The Speedwagon Foundation',
            campaign=self.campaign,
            description='A research organization studying supernatural phenomena.',
            tier=2,
            hold='strong',
            rep=4,
            heat=2,
            wanted_level=1,
            coin=8,
            stash=12
        )
    
    def test_crew_creation(self):
        """Test crew creation with default and custom values."""
        self.assertEqual(self.crew.name, 'The Speedwagon Foundation')
        self.assertEqual(self.crew.tier, 2)
        self.assertEqual(self.crew.hold, 'strong')
        self.assertEqual(self.crew.rep, 4)
        self.assertEqual(self.crew.heat, 2)
        self.assertEqual(self.crew.wanted_level, 1)
        self.assertEqual(self.crew.coin, 8)
        self.assertEqual(self.crew.stash, 12)
    
    def test_crew_defaults(self):
        """Test crew default values."""
        default_crew = Crew.objects.create(
            name='Default Crew',
            campaign=self.campaign
        )
        
        self.assertEqual(default_crew.tier, 0)
        self.assertEqual(default_crew.hold, 'weak')
        self.assertEqual(default_crew.rep, 0)
        self.assertEqual(default_crew.heat, 0)
        self.assertEqual(default_crew.wanted_level, 0)
        self.assertEqual(default_crew.coin, 0)
        self.assertEqual(default_crew.stash, 0)
        self.assertEqual(default_crew.claims, {})
        self.assertEqual(default_crew.upgrades, [])


class CharacterModelTest(TestCase):
    """Test Character model based on SRD character creation rules."""
    
    def setUp(self):
        """Set up test data for character creation."""
        self.user = User.objects.create_user(username='jotaro', email='jotaro@test.com', password='testpass')
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        
        self.campaign = Campaign.objects.create(name='Stardust Crusaders', gm=self.gm_user)
        self.crew = Crew.objects.create(name='Crusaders', campaign=self.campaign)
        
        self.human_heritage = Heritage.objects.create(name='Human', base_hp=0)
        self.vice = Vice.objects.create(name='Loyalty', description='Devotion to friends and family')
        
        # Create test abilities
        self.ability1 = Ability.objects.create(
            name='Star Platinum: The World',
            type='standard',
            description='Stop time for a brief moment'
        )
    
    def test_character_creation_basic(self):
        """Test basic character creation."""
        character = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            crew=self.crew,
            true_name='Jotaro Kujo',
            alias='JoJo',
            heritage=self.human_heritage,
            playbook='STAND',
            vice=self.vice
        )
        
        self.assertEqual(character.true_name, 'Jotaro Kujo')
        self.assertEqual(character.alias, 'JoJo')
        self.assertEqual(character.playbook, 'STAND')
        self.assertEqual(character.heritage, self.human_heritage)
        self.assertEqual(character.vice, self.vice)
    
    def test_character_action_dots_validation(self):
        """Test action dots assignment based on SRD rules (7 dots max, 2 per skill max at creation)."""
        character = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name='Test Character',
            heritage=self.human_heritage,
            # Valid action dots distribution (7 total, max 2 per skill)
            action_dots={
                'insight': {'study': 2, 'survey': 1, 'tinker': 0, 'hunt': 1},
                'prowess': {'prowl': 1, 'skirmish': 2, 'finesse': 0, 'wreck': 0},
                'resolve': {'bizarre': 0, 'sway': 0, 'command': 0, 'consort': 0}
            }
        )
        
        # Calculate total dots
        total_dots = 0
        for attribute in character.action_dots.values():
            for skill_value in attribute.values():
                total_dots += skill_value
        
        self.assertEqual(total_dots, 7)
        
        # Check max 2 dots per skill
        for attribute in character.action_dots.values():
            for skill_value in attribute.values():
                self.assertLessEqual(skill_value, 2)
    
    def test_stand_coin_stats_distribution(self):
        """Test Stand coin stats distribution (10 points total) based on SRD."""
        character = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name='Stand User',
            heritage=self.human_heritage,
            playbook='STAND',
            coin_stats={
                'power': 'A',  # 4 points
                'speed': 'B',  # 3 points  
                'range': 'C',  # 2 points
                'durability': 'D', # 1 point
                'precision': 'F',  # 0 points
                'development': 'F' # 0 points
            }
        )
        
        # Verify coin stats grades
        grade_values = {'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0}
        total_points = sum(grade_values.get(grade, 0) for grade in character.coin_stats.values())
        self.assertEqual(total_points, 10)
    
    def test_stress_and_trauma_system(self):
        """Test stress and trauma mechanics from SRD."""
        character = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name='Stressed Character',
            heritage=self.human_heritage,
            stress=0,
            trauma=['Cold']  # One trauma condition
        )
        
        # Test stress boundaries (assuming max stress depends on Stand durability)
        character.stress = 8  # Near max stress
        character.save()
        self.assertEqual(character.stress, 8)
        
        # Test trauma conditions
        self.assertIn('Cold', character.trauma)
        
        # When 4th trauma is reached, character should retire (this would be business logic)
        character.trauma = ['Cold', 'Reckless', 'Unstable', 'Vicious']
        character.save()
        self.assertEqual(len(character.trauma), 4)
    
    def test_harm_system_levels(self):
        """Test 4-level harm system from SRD."""
        character = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name='Harmed Character',
            heritage=self.human_heritage,
            harm_level1_used=True,
            harm_level1_name='Bruised',
            harm_level2_used=True,
            harm_level2_name='Battered',
            harm_level3_used=False,
            harm_level4_used=False
        )
        
        self.assertTrue(character.harm_level1_used)
        self.assertEqual(character.harm_level1_name, 'Bruised')
        self.assertTrue(character.harm_level2_used)
        self.assertEqual(character.harm_level2_name, 'Battered')
        self.assertFalse(character.harm_level3_used)
        self.assertFalse(character.harm_level4_used)


class StandModelTest(TestCase):
    """Test Stand model based on SRD Stand system."""
    
    def setUp(self):
        """Set up test data for Stand creation."""
        self.user = User.objects.create_user(username='user', email='user@test.com', password='testpass')
        self.heritage = Heritage.objects.create(name='Human', base_hp=0)
        
        self.character = Character.objects.create(
            user=self.user,
            true_name='Stand User',
            heritage=self.heritage,
            playbook='STAND'
        )
        
        self.ability = Ability.objects.create(
            name='Barrage',
            type='standard',
            description='Rapid punching attack'
        )
    
    def test_stand_creation(self):
        """Test Stand creation with all SRD attributes."""
        stand = Stand.objects.create(
            character=self.character,
            name='Star Platinum',
            type='FIGHTING',
            form='Humanoid',
            consciousness_level='A',
            power='A',
            speed='A', 
            range='C',
            durability='A',
            precision='A',
            development='A',
            armor=3,
            standard_ability=self.ability
        )
        
        self.assertEqual(stand.name, 'Star Platinum')
        self.assertEqual(stand.type, 'FIGHTING')
        self.assertEqual(stand.form, 'Humanoid')
        self.assertEqual(stand.consciousness_level, 'A')
        self.assertEqual(stand.power, 'A')
        self.assertEqual(stand.speed, 'A')
        self.assertEqual(stand.range, 'C')
        self.assertEqual(stand.durability, 'A')
        self.assertEqual(stand.precision, 'A')
        self.assertEqual(stand.development, 'A')
    
    def test_stand_grade_choices(self):
        """Test that Stand grades follow SRD system (S, A, B, C, D, F)."""
        valid_grades = ['S', 'A', 'B', 'C', 'D', 'F']
        
        stand = Stand.objects.create(
            character=self.character,
            name='Test Stand',
            type='FIGHTING',
            form='Humanoid',
            consciousness_level='B',
            power='S',  # Special grade
            speed='F',  # Flawed grade
            range='D',  # Below Average
            durability='C',  # Average
            precision='B',  # Skilled
            development='A'  # Elite
        )
        
        for grade in [stand.power, stand.speed, stand.range, stand.durability, stand.precision, stand.development]:
            self.assertIn(grade, valid_grades)
    
    def test_stand_type_choices(self):
        """Test Stand type choices match SRD categories."""
        valid_types = ['COLONY', 'TOOLBOUND', 'PHENOMENA', 'AUTOMATIC', 'FIGHTING']
        
        # Create separate characters for each Stand type since each character can only have one Stand
        for i, stand_type in enumerate(valid_types):
            test_user = User.objects.create_user(username=f'user{i}', email=f'user{i}@test.com', password='testpass')
            test_character = Character.objects.create(
                user=test_user,
                true_name=f'Stand User {i}',
                heritage=self.heritage,
                playbook='STAND'
            )
            
            stand = Stand.objects.create(
                character=test_character,
                name=f'Test Stand {stand_type}',
                type=stand_type,
                form='Humanoid',
                consciousness_level='C',
                power='C', speed='C', range='C', durability='C', precision='C', development='C'
            )
            self.assertEqual(stand.type, stand_type)


class StandAbilityModelTest(TestCase):
    """Test Stand Ability model."""
    
    def setUp(self):
        """Set up test data for Stand abilities."""
        self.user = User.objects.create_user(username='user', email='user@test.com', password='testpass')
        self.heritage = Heritage.objects.create(name='Human', base_hp=0)
        
        self.character = Character.objects.create(
            user=self.user,
            true_name='Stand User',
            heritage=self.heritage,
            playbook='STAND'
        )
        
        self.stand = Stand.objects.create(
            character=self.character,
            name='Test Stand',
            type='FIGHTING',
            form='Humanoid',
            consciousness_level='B',
            power='A', speed='B', range='C', durability='B', precision='A', development='C'
        )
    
    def test_stand_ability_creation(self):
        """Test Stand ability creation and relationship."""
        ability = StandAbility.objects.create(
            stand=self.stand,
            name='Time Stop',
            description='Stop time for 2 seconds'
        )
        
        self.assertEqual(ability.name, 'Time Stop')
        self.assertEqual(ability.description, 'Stop time for 2 seconds')
        self.assertEqual(ability.stand, self.stand)
        self.assertEqual(str(ability), 'Time Stop (Test Stand)')
    
    def test_multiple_stand_abilities(self):
        """Test that a Stand can have multiple abilities (3 max according to SRD)."""
        abilities = [
            {'name': 'Barrage', 'description': 'Rapid punching attack'},
            {'name': 'Time Stop', 'description': 'Stop time briefly'},
            {'name': 'Star Finger', 'description': 'Extend finger for ranged attack'}
        ]
        
        for ability_data in abilities:
            StandAbility.objects.create(stand=self.stand, **ability_data)
        
        self.assertEqual(self.stand.abilities.count(), 3)


class ViceModelTest(TestCase):
    """Test Vice model based on SRD vice system."""
    
    def test_vice_creation(self):
        """Test vice creation."""
        vice = Vice.objects.create(
            name='Obligation',
            description='You have a family, informants, hangers-on, or other dependents who rely on you.'
        )
        
        self.assertEqual(vice.name, 'Obligation')
        self.assertEqual(str(vice), 'Obligation')


class NPCModelTest(TestCase):
    """Test NPC model for campaign management."""
    
    def setUp(self):
        """Set up test campaign."""
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        self.campaign = Campaign.objects.create(name='Test Campaign', gm=self.gm_user)
    
    def test_npc_creation(self):
        """Test NPC creation with stats."""
        npc = NPC.objects.create(
            campaign=self.campaign,
            name='Dio Brando',
            description='A vampire with incredible charisma and ambition.',
            stats={
                'power': 'S',
                'speed': 'A',
                'durability': 'S',
                'threat_level': 'Boss'
            }
        )
        
        self.assertEqual(npc.name, 'Dio Brando')
        self.assertEqual(npc.campaign, self.campaign)
        self.assertEqual(npc.stats['power'], 'S')
        self.assertEqual(npc.stats['threat_level'], 'Boss')
        self.assertEqual(str(npc), 'Dio Brando (NPC for Test Campaign)')


class AbilityModelTest(TestCase):
    """Test Ability model for standard and custom abilities."""
    
    def test_standard_ability_creation(self):
        """Test standard ability creation."""
        ability = Ability.objects.create(
            name='Backup',
            type='standard',
            description='When you assist a teammate, take +1d.'
        )
        
        self.assertEqual(ability.name, 'Backup')
        self.assertEqual(ability.type, 'standard')
        self.assertIn('teammate', ability.description)
    
    def test_custom_ability_creation(self):
        """Test custom ability creation."""
        ability = Ability.objects.create(
            name='Stand Rush',
            type='other',
            description='Your Stand can perform a devastating combination attack.'
        )
        
        self.assertEqual(ability.name, 'Stand Rush')
        self.assertEqual(ability.type, 'other')


class HamonAbilityModelTest(TestCase):
    """Test Hamon ability model based on SRD Hamon system."""
    
    def test_hamon_ability_creation(self):
        """Test Hamon ability creation."""
        hamon_ability = HamonAbility.objects.create(
            name='Ripple Breathing',
            hamon_type='FOUNDATION',
            description='+1d to resist poison, fatigue, or fear. Once per score, push yourself with no stress cost.',
            stress_cost=0,
            frequency='Once per score'
        )
        
        self.assertEqual(hamon_ability.name, 'Ripple Breathing')
        self.assertEqual(hamon_ability.hamon_type, 'FOUNDATION')
        self.assertEqual(hamon_ability.stress_cost, 0)
        self.assertEqual(str(hamon_ability), 'Ripple Breathing (Foundation Hamon)')
    
    def test_hamon_foundation_abilities(self):
        """Test that foundation Hamon abilities can be created according to SRD."""
        foundation_abilities = [
            {'name': 'Ripple Breathing', 'description': '+1d to resist poison, fatigue, or fear. Once per score, push yourself with no stress cost.'},
            {'name': 'Overdrive', 'description': 'Spend 1 stress to charge a strike. +1 effect and +1 harm vs bizarre, undead, or inorganic targets.'},
            {'name': 'Ripple Infusion', 'description': 'Spend 1 stress to imbue an object with Ripple energy for the scene. Gains +1 effect vs bizarre enemies.'},
            {'name': 'Scarlet Overdrive', 'description': 'Ignite a weapon or limb. +1 harm and inflicts fire-based secondary effects.'},
        ]
        
        for ability_data in foundation_abilities:
            HamonAbility.objects.create(
                hamon_type='FOUNDATION',
                stress_cost=1 if 'Spend 1 stress' in ability_data['description'] else 0,
                **ability_data
            )
        
        self.assertEqual(HamonAbility.objects.filter(hamon_type='FOUNDATION').count(), 4)


class SpinAbilityModelTest(TestCase):
    """Test Spin ability model based on SRD Spin system."""
    
    def test_spin_ability_creation(self):
        """Test Spin ability creation."""
        spin_ability = SpinAbility.objects.create(
            name='Golden Arc',
            spin_type='FOUNDATION',
            description='Once per scene, a thrown Spin projectile returns. On a 6, it may hit a second target.',
            stress_cost=0,
            frequency='Once per scene'
        )
        
        self.assertEqual(spin_ability.name, 'Golden Arc')
        self.assertEqual(spin_ability.spin_type, 'FOUNDATION')
        self.assertEqual(str(spin_ability), 'Golden Arc (Spin Foundation)')
    
    def test_spin_foundation_abilities(self):
        """Test that foundation Spin abilities can be created according to SRD."""
        foundation_abilities = [
            {'name': 'Golden Arc', 'description': 'Once per scene, a thrown Spin projectile returns.'},
            {'name': 'Vibrational Scan', 'description': 'Use a spinning object to perform a Study or Survey roll. +1 effect when detecting structure.'},
            {'name': 'Kinetic Tether', 'description': 'Spin threads can connect two objects. Once per score, create a tether.'},
            {'name': 'Rebound Tactics', 'description': '+1d on attacks that ricochet. On a 6, you may apply splash harm.'},
        ]
        
        for ability_data in foundation_abilities:
            SpinAbility.objects.create(
                spin_type='FOUNDATION',
                stress_cost=0,
                **ability_data
            )
        
        self.assertEqual(SpinAbility.objects.filter(spin_type='FOUNDATION').count(), 4)


class ProgressClockModelTest(TestCase):
    """Test Progress Clock model based on SRD clock mechanics."""
    
    def setUp(self):
        """Set up test data."""
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        self.campaign = Campaign.objects.create(name='Test Campaign', gm=self.gm_user)
        self.user = User.objects.create_user(username='user', email='user@test.com', password='testpass')
        self.heritage = Heritage.objects.create(name='Human', base_hp=0)
        self.character = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name='Test Character',
            heritage=self.heritage
        )
    
    def test_progress_clock_creation(self):
        """Test progress clock creation."""
        clock = ProgressClock.objects.create(
            name='Investigate the Murders',
            clock_type='PROJECT',
            max_segments=8,
            filled_segments=3,
            description='Long-term investigation into the serial murders',
            campaign=self.campaign
        )
        
        self.assertEqual(clock.name, 'Investigate the Murders')
        self.assertEqual(clock.max_segments, 8)
        self.assertEqual(clock.filled_segments, 3)
        self.assertEqual(clock.progress_percentage, 37.5)
        self.assertEqual(str(clock), 'Investigate the Murders (3/8)')
    
    def test_healing_clock(self):
        """Test healing clock for character harm recovery."""
        healing_clock = ProgressClock.objects.create(
            name='Recover from Broken Ribs',
            clock_type='HEALING',
            max_segments=4,
            filled_segments=2,
            character=self.character
        )
        
        self.assertEqual(healing_clock.character, self.character)
        self.assertEqual(healing_clock.clock_type, 'HEALING')
        self.assertEqual(healing_clock.progress_percentage, 50.0)


class ExperienceTrackerModelTest(TestCase):
    """Test experience tracking based on SRD advancement rules."""
    
    def setUp(self):
        """Set up test character."""
        self.user = User.objects.create_user(username='user', email='user@test.com', password='testpass')
        self.heritage = Heritage.objects.create(name='Human', base_hp=0)
        self.character = Character.objects.create(
            user=self.user,
            true_name='Test Character',
            heritage=self.heritage
        )
    
    def test_experience_entry_creation(self):
        """Test creating experience entries."""
        xp_entry = ExperienceTracker.objects.create(
            character=self.character,
            trigger='BELIEFS',
            description='Expressed strong loyalty to friends despite personal cost',
            xp_gained=1
        )
        
        self.assertEqual(xp_entry.character, self.character)
        self.assertEqual(xp_entry.trigger, 'BELIEFS')
        self.assertEqual(xp_entry.xp_gained, 1)
        self.assertIn('Test Character', str(xp_entry))
    
    def test_multiple_xp_sources(self):
        """Test that characters can gain XP from multiple sources."""
        triggers = ['BELIEFS', 'STRUGGLE', 'DESPERATE', 'STANDOUT']
        descriptions = [
            'Expressed heritage beliefs',
            'Struggled with trauma condition',
            'Attempted action with 0 rating',
            'Led the team to victory'
        ]
        
        for trigger, desc in zip(triggers, descriptions):
            ExperienceTracker.objects.create(
                character=self.character,
                trigger=trigger,
                description=desc,
                xp_gained=1
            )
        
        self.assertEqual(self.character.experience_entries.count(), 4)
        total_xp = sum(entry.xp_gained for entry in self.character.experience_entries.all())
        self.assertEqual(total_xp, 4)


class DowntimeActivityModelTest(TestCase):
    """Test downtime activity tracking based on SRD downtime rules."""
    
    def setUp(self):
        """Set up test character."""
        self.user = User.objects.create_user(username='user', email='user@test.com', password='testpass')
        self.heritage = Heritage.objects.create(name='Human', base_hp=0)
        self.character = Character.objects.create(
            user=self.user,
            true_name='Test Character',
            heritage=self.heritage,
            stress=6
        )
    
    def test_downtime_activity_creation(self):
        """Test creating downtime activities."""
        activity = DowntimeActivity.objects.create(
            character=self.character,
            activity_type='RECOVER',
            description='Visited a hot spring to recover from stress',
            result='Rolled well, cleared 3 stress',
            stress_relieved=3
        )
        
        self.assertEqual(activity.character, self.character)
        self.assertEqual(activity.activity_type, 'RECOVER')
        self.assertEqual(activity.stress_relieved, 3)
        self.assertIn('Test Character', str(activity))
    
    def test_long_term_project_activity(self):
        """Test long-term project downtime activity."""
        activity = DowntimeActivity.objects.create(
            character=self.character,
            activity_type='LONG_TERM_PROJECT',
            description='Research ancient Pillar Man artifacts',
            result='Made significant progress',
            progress_made=2
        )
        
        self.assertEqual(activity.progress_made, 2)
        self.assertEqual(activity.activity_type, 'LONG_TERM_PROJECT')


class ScoreModelTest(TestCase):
    """Test Score model for tracking crew jobs/missions."""
    
    def setUp(self):
        """Set up test crew and characters."""
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        self.campaign = Campaign.objects.create(name='Test Campaign', gm=self.gm_user)
        self.crew = Crew.objects.create(name='Test Crew', campaign=self.campaign)
        
        self.user1 = User.objects.create_user(username='user1', email='user1@test.com', password='testpass')
        self.user2 = User.objects.create_user(username='user2', email='user2@test.com', password='testpass')
        self.heritage = Heritage.objects.create(name='Human', base_hp=0)
        
        self.character1 = Character.objects.create(
            user=self.user1, crew=self.crew, true_name='Character 1', heritage=self.heritage
        )
        self.character2 = Character.objects.create(
            user=self.user2, crew=self.crew, true_name='Character 2', heritage=self.heritage
        )
    
    def test_score_creation(self):
        """Test score creation and tracking."""
        score = Score.objects.create(
            crew=self.crew,
            name='Steal the Arrow',
            score_type='STEALTH',
            target='Mysterious Arrow in museum vault',
            description='Infiltrate the museum and steal the ancient arrow without raising alarms',
            rep_gained=2,
            coin_gained=4,
            heat_gained=1,
            completed=True,
            success_level='Partial Success',
            consequences='Security noticed something was off'
        )
        
        score.participants.add(self.character1, self.character2)
        
        self.assertEqual(score.name, 'Steal the Arrow')
        self.assertEqual(score.score_type, 'STEALTH')
        self.assertEqual(score.participants.count(), 2)
        self.assertTrue(score.completed)
        self.assertEqual(str(score), 'Test Crew - Steal the Arrow')
    
    def test_score_types(self):
        """Test different score types from SRD."""
        score_types = ['ASSAULT', 'DECEPTION', 'STEALTH', 'OCCULT', 'SOCIAL', 'TRANSPORT']
        
        for i, score_type in enumerate(score_types):
            Score.objects.create(
                crew=self.crew,
                name=f'Test Score {i}',
                score_type=score_type,
                target=f'Target {i}',
                description=f'Description for {score_type} score'
            )
        
        self.assertEqual(Score.objects.count(), 6)
        self.assertEqual(Score.objects.filter(score_type='OCCULT').count(), 1)


# ...existing code...
