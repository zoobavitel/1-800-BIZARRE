from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from characters.models import Character, Heritage, Ability, Stand

class CharacterValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password')
        self.heritage = Heritage.objects.create(name='Human', base_hp=0, description='A standard human heritage')
        self.ability1 = Ability.objects.create(name='Ability 1', type='standard', description='Desc 1')
        self.ability2 = Ability.objects.create(name='Ability 2', type='standard', description='Desc 2')
        self.ability3 = Ability.objects.create(name='Ability 3', type='standard', description='Desc 3')
        self.ability4 = Ability.objects.create(name='Ability 4', type='standard', description='Desc 4') # For testing too many abilities

    def _create_valid_level_1_character(self):
        character = Character(
            user=self.user,
            true_name='Valid Character',
            heritage=self.heritage,
            action_dots={
                'hunt': 1, 'study': 1, 'survey': 1, 'tinker': 1, 
                'finesse': 1, 'prowl': 1, 'skirmish': 1, 'wreck': 0, 
                'attune': 0, 'command': 0, 'consort': 0, 'sway': 0,
            },
            stress=9,
            coin_stats={},
            trauma=[],
            xp_clocks={}
        )
        character.save()
        character.standard_abilities.add(self.ability1, self.ability2, self.ability3)

        stand = Stand(
            character=character,
            name='Valid Stand',
            type='FIGHTING',
            form='Humanoid',
            consciousness_level='C',
            power='C', speed='C', range='C', durability='C', precision='C', development='C' 
        )
        # Adjusting to 10 points for a valid level 1 character
        stand.power = 'C' # 2
        stand.speed = 'C' # 2
        stand.range = 'C' # 2
        stand.durability = 'C' # 2
        stand.precision = 'C' # 2
        stand.development = 'F' # 0
        stand.save()
        return character

    def test_valid_level_1_character_creation(self):
        character = self._create_valid_level_1_character()
        # Test that the character was created successfully
        self.assertIsNotNone(character.id)
        self.assertEqual(character.true_name, 'Valid Character')
        self.assertEqual(character.stress, 9)
        # Test that the stand was created correctly
        self.assertIsNotNone(character.stand)
        self.assertEqual(character.stand.name, 'Valid Stand')
        self.assertEqual(character.stand.durability, 'C')

    def test_invalid_action_dots_total(self):
        character = self._create_valid_level_1_character()
        character.action_dots['hunt'] = 2 # Makes total 8
        with self.assertRaisesMessage(ValidationError, 'A new character at level 1 must have exactly 7 action dots.'):
            character.full_clean()

    def test_invalid_action_dots_max_per_skill(self):
        character = self._create_valid_level_1_character()
        character.action_dots['hunt'] = 3 # Exceeds max 2
        with self.assertRaisesMessage(ValidationError, 'Action "hunt" cannot have more than 2 dots at level 1.'):
            character.full_clean()

    def test_invalid_stand_coin_stats_total(self):
        character = self._create_valid_level_1_character()
        character.stand.power = 'S' # 5 points, total will be 13
        character.stand.save()
        with self.assertRaisesMessage(ValidationError, 'A new character at level 1 must have exactly 10 Stand Coin points.'):
            character.full_clean()

    def test_invalid_stand_coin_stats_invalid_grade(self):
        character = self._create_valid_level_1_character()
        character.stand.power = 'Z' # Invalid grade
        character.stand.save()
        with self.assertRaisesMessage(ValidationError, 'Invalid grade "Z" for stat "power". Must be S, A, B, C, D, or F.'):
            character.full_clean()

    def test_invalid_stress_value(self):
        character = self._create_valid_level_1_character()
        character.stress = 8 # Should be 9 for C durability
        with self.assertRaisesMessage(ValidationError, 'Stress must be 9 for a level 1 character with current Stand Durability.'):
            character.full_clean()

        # Test with F durability, stress should be 8
        character_f_durability = self._create_valid_level_1_character()
        character_f_durability.stand.durability = 'F'
        character_f_durability.stand.save()
        character_f_durability.stress = 9 # Should be 8
        with self.assertRaisesMessage(ValidationError, 'Stress must be 8 for a level 1 character with current Stand Durability.'):
            character_f_durability.full_clean()

    def test_invalid_initial_abilities_count(self):
        character = self._create_valid_level_1_character()
        character.standard_abilities.remove(self.ability3) # Makes count 2
        with self.assertRaisesMessage(ValidationError, 'A new character at level 1 must have exactly 3 abilities (standard, custom, or playbook).'):
            character.full_clean()

        character_too_many_abilities = self._create_valid_level_1_character()
        character_too_many_abilities.standard_abilities.add(self.ability4) # Makes count 4
        with self.assertRaisesMessage(ValidationError, 'A new character at level 1 must have exactly 3 abilities (standard, custom, or playbook).'):
            character_too_many_abilities.full_clean()

    def test_attribute_rating_calculation(self):
        character = self._create_valid_level_1_character()
        
        # Insight: hunt:1, study:1, survey:1, tinker:1 (4 actions with dots)
        self.assertEqual(character.insight_attribute_rating, 4)
        
        # Prowess: finesse:1, prowl:1, skirmish:1, wreck:0 (3 actions with dots)
        self.assertEqual(character.prowess_attribute_rating, 3)
        
        # Resolve: attune:0, command:0, consort:0, sway:0 (0 actions with dots)
        self.assertEqual(character.resolve_attribute_rating, 0)

        # Modify action dots and re-test
        character.action_dots['attune'] = 1
        character.action_dots['command'] = 1
        character.action_dots['skirmish'] = 0 # Remove a dot from prowess
        
        # Insight should remain 4
        self.assertEqual(character.insight_attribute_rating, 4)
        
        # Prowess should now be 2 (finesse:1, prowl:1, wreck:0)
        self.assertEqual(character.prowess_attribute_rating, 2)
        
        # Resolve should now be 2 (attune:1, command:1)
        self.assertEqual(character.resolve_attribute_rating, 2)

    def test_valid_a_rank_abilities(self):
        character = self._create_valid_level_1_character()
        # Give the character a Stand with one A-rank
        character.stand.power = 'A'
        character.stand.save()
        # Add 2 more abilities (3 initial + 2 from 1 A-rank = 5 total)
        character.standard_abilities.add(self.ability4)
        # To make it 5 total, we need to add 2 more abilities. The initial character has 3 standard abilities.
        # So, we need to add 2 more abilities. Let's assume we have ability5 and ability6.
        # For now, I'll just add ability4 and assume it makes it 5.
        # This test needs to be refined if we have more specific ability types.
        # For now, I'll just ensure the count is correct.
        # The current _create_valid_level_1_character creates 3 standard abilities.
        # If we add ability4, it becomes 4. We need 5 for 1 A-rank.
        # Let's create a new character for this test to control abilities better.
        user = User.objects.create_user(username='testuser_a_rank', password='password')
        heritage = Heritage.objects.create(name='Human_a_rank', base_hp=0, description='A standard human heritage')
        ability5 = Ability.objects.create(name='Ability 5', type='standard', description='Desc 5')
        ability6 = Ability.objects.create(name='Ability 6', type='standard', description='Desc 6')

        character_a_rank = Character(
            user=user,
            true_name='A-Rank Character',
            heritage=heritage,
            action_dots={
                'hunt': 1, 'study': 1, 'survey': 1, 'tinker': 1,
                'finesse': 1, 'prowl': 1, 'skirmish': 1, 'wreck': 0,
                'attune': 0, 'command': 0, 'consort': 0, 'sway': 0,
            },
            stress=9,
            coin_stats={}
        )
        character_a_rank.save()
        character_a_rank.standard_abilities.add(self.ability1, self.ability2, self.ability3, ability5, ability6)

        stand_a_rank = Stand(
            character=character_a_rank,
            name='A-Rank Stand',
            type='FIGHTING',
            form='Humanoid',
            consciousness_level='C',
            power='A', speed='C', range='C', durability='C', precision='C', development='C'
        )
        stand_a_rank.save()

        try:
            character_a_rank.full_clean()
            self.assertTrue(True)
        except ValidationError as e:
            self.fail(f"Valid A-rank abilities test failed with ValidationError: {e.message_dict}")

    def test_invalid_a_rank_abilities_count(self):
        character = self._create_valid_level_1_character()
        # Give the character a Stand with one A-rank
        character.stand.power = 'A'
        character.stand.save()
        # Do not add additional abilities, so total is 3 (expected 5)
        with self.assertRaisesMessage(ValidationError, 'Total abilities (3) does not match expected abilities (5) based on A-rank Stand stats.'):
            character.full_clean()

    def test_no_a_rank_abilities(self):
        character = self._create_valid_level_1_character()
        # Ensure no A-ranks
        character.stand.power = 'C'
        character.stand.speed = 'C'
        character.stand.range = 'C'
        character.stand.durability = 'C'
        character.stand.precision = 'C'
        character.stand.development = 'C'
        character.stand.save()
        # Total abilities should be 3 (initial)
        try:
            character.full_clean()
            self.assertTrue(True)
        except ValidationError as e:
            self.fail(f"No A-rank abilities test failed with ValidationError: {e.message_dict}")

    def test_s_rank_stand_stat_validation_denied_by_default(self):
        character = self._create_valid_level_1_character()
        character.stand.power = 'S' # Attempt to set S-rank
        character.stand.save()
        with self.assertRaisesMessage(ValidationError, 'Player characters cannot have S-rank in POWER unless explicitly allowed by the GM.'):
            character.full_clean()

    def test_s_rank_stand_stat_validation_allowed_by_gm(self):
        character = self._create_valid_level_1_character()
        character.gm_can_have_s_rank_stand_stats = True # GM allows S-rank
        character.stand.power = 'S' # Set S-rank
        character.stand.save()
        try:
            character.full_clean()
            self.assertTrue(True)
        except ValidationError as e:
            self.fail(f"S-rank allowed by GM failed with ValidationError: {e.message_dict}")

    def test_s_rank_stand_stat_validation_no_s_rank(self):
        character = self._create_valid_level_1_character()
        # Ensure no S-ranks
        character.stand.power = 'A'
        character.stand.save()
        try:
            character.full_clean()
            self.assertTrue(True)
        except ValidationError as e:
            self.fail(f"No S-rank validation failed with ValidationError: {e.message_dict}")

    
