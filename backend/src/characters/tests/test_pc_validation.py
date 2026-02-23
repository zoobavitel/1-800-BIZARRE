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
                'bizarre': 0, 'command': 0, 'consort': 0, 'sway': 0,
            },
            stress=9,
            coin_stats={},
            trauma=[],
            xp_clocks={}
        )
        character.save()
        character.standard_abilities.add(self.ability1, self.ability2, self.ability3)

        # SRD: Distribute 6 points at creation. Grade points: A=4, B=3, C=2, D=1, F=0.
        stand = Stand(
            character=character,
            name='Valid Stand',
            type='FIGHTING',
            form='Humanoid',
            consciousness_level='C',
            power='C', speed='D', range='D', durability='D', precision='D', development='F'
        )
        # C(2)+D(1)+D(1)+D(1)+D(1)+F(0) = 6 points. Durability D => stress 9.
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
        self.assertEqual(character.stand.durability, 'D')

    def test_invalid_action_dots_total(self):
        character = self._create_valid_level_1_character()
        character.action_dots['hunt'] = 2 # Makes total 8
        with self.assertRaisesMessage(ValidationError, 'A new character at level 1 must have exactly 7 action dots.'):
            character.full_clean()

    def test_invalid_action_dots_max_per_skill(self):
        character = self._create_valid_level_1_character()
        # Keep total 7 so we hit the per-skill cap: hunt 3, study 0, survey 0, rest unchanged => 7 total
        character.action_dots['hunt'] = 3  # Exceeds max 2
        character.action_dots['study'] = 0
        character.action_dots['survey'] = 0
        with self.assertRaisesMessage(ValidationError, 'Action "hunt" cannot have more than 2 dots at level 1.'):
            character.full_clean()

    def test_invalid_stand_coin_stats_total(self):
        character = self._create_valid_level_1_character()
        character.stand.power = 'A'  # 4 points; with rest (D+D+C+D+F=4) total would be 8
        character.stand.speed = 'A'
        character.stand.save()
        with self.assertRaisesMessage(ValidationError, 'A new character at level 1 must have exactly 6 Stand Coin points.'):
            character.full_clean()

    def test_invalid_stand_coin_stats_invalid_grade(self):
        character = self._create_valid_level_1_character()
        character.stand.power = 'Z' # Invalid grade
        character.stand.save()
        with self.assertRaisesMessage(ValidationError, 'Invalid grade "Z" for stat "power". Must be S, A, B, C, D, or F.'):
            character.full_clean()

    def test_invalid_stress_value(self):
        character = self._create_valid_level_1_character()
        character.stress = 8  # Should be 9 for D durability
        with self.assertRaisesMessage(ValidationError, 'Stress must be 9 for a level 1 character with D Stand Durability.'):
            character.full_clean()

        # Test with F durability, stress should be 8. 6 points: A+C+F+F+F+F = 4+2+0+0+0+0 = 6.
        character_f_durability = self._create_valid_level_1_character()
        character_f_durability.stand.power = 'A'
        character_f_durability.stand.speed = 'C'
        character_f_durability.stand.range = 'F'
        character_f_durability.stand.durability = 'F'
        character_f_durability.stand.precision = 'F'
        character_f_durability.stand.development = 'F'
        character_f_durability.stand.save()
        character_f_durability.stress = 9  # Should be 8 for F
        with self.assertRaisesMessage(ValidationError, 'Stress must be 8 for a level 1 character with F Stand Durability.'):
            character_f_durability.full_clean()

    def test_invalid_initial_abilities_count(self):
        character = self._create_valid_level_1_character()
        character.standard_abilities.remove(self.ability3)  # Makes count 2; expected 3
        with self.assertRaisesMessage(ValidationError, 'A level 1 character must have exactly 3 abilities'):
            character.full_clean()

        character_too_many_abilities = self._create_valid_level_1_character()
        character_too_many_abilities.standard_abilities.add(self.ability4)  # Makes count 4; expected 3
        with self.assertRaisesMessage(ValidationError, 'A level 1 character must have exactly 3 abilities'):
            character_too_many_abilities.full_clean()

    def test_attribute_rating_calculation(self):
        character = self._create_valid_level_1_character()
        
        # Insight: hunt:1, study:1, survey:1, tinker:1 (4 actions with dots)
        self.assertEqual(character.insight_attribute_rating, 4)
        
        # Prowess: finesse:1, prowl:1, skirmish:1, wreck:0 (3 actions with dots)
        self.assertEqual(character.prowess_attribute_rating, 3)
        
        # Resolve: attune:0, command:0, consort:0, sway:0 (0 actions with dots)
        self.assertEqual(character.resolve_attribute_rating, 0)

        # Modify action dots and re-test (SRD Resolve = bizarre, sway, command, consort)
        character.action_dots['bizarre'] = 1
        character.action_dots['command'] = 1
        character.action_dots['skirmish'] = 0  # Remove a dot from prowess
        
        # Insight should remain 4
        self.assertEqual(character.insight_attribute_rating, 4)
        
        # Prowess should now be 2 (finesse:1, prowl:1, wreck:0)
        self.assertEqual(character.prowess_attribute_rating, 2)
        
        # Resolve should now be 2 (bizarre:1, command:1)
        self.assertEqual(character.resolve_attribute_rating, 2)

    def test_valid_a_rank_abilities(self):
        # SRD: 3 base + 2 per A-rank. One A-rank => 5 abilities. Stand 6 points: A(4)+D(1)+D(1)+F+F+F = 6.
        user = User.objects.create_user(username='testuser_a_rank', password='password')
        heritage = Heritage.objects.create(name='Human_a_rank', base_hp=0, description='A standard human heritage')
        ability5 = Ability.objects.create(name='Ability 5', type='standard', description='Desc 5')

        character_a_rank = Character(
            user=user,
            true_name='A-Rank Character',
            heritage=heritage,
            action_dots={
                'hunt': 1, 'study': 1, 'survey': 1, 'tinker': 1,
                'finesse': 1, 'prowl': 1, 'skirmish': 1, 'wreck': 0,
                'bizarre': 0, 'command': 0, 'consort': 0, 'sway': 0,
            },
            stress=8,
            coin_stats={}
        )
        character_a_rank.save()
        character_a_rank.standard_abilities.add(self.ability1, self.ability2, self.ability3, self.ability4, ability5)

        stand_a_rank = Stand(
            character=character_a_rank,
            name='A-Rank Stand',
            type='FIGHTING',
            form='Humanoid',
            consciousness_level='C',
            power='A', speed='D', range='D', durability='F', precision='F', development='F'
        )
        stand_a_rank.save()

        try:
            character_a_rank.full_clean()
            self.assertTrue(True)
        except ValidationError as e:
            self.fail(f"Valid A-rank abilities test failed with ValidationError: {e.message_dict}")

    def test_invalid_a_rank_abilities_count(self):
        character = self._create_valid_level_1_character()
        # 6 points with one A-rank: A(4)+D(1)+D(1)+F+F+F = 6. Durability F => stress 8. Do not add abilities (have 3, need 5).
        character.stand.power = 'A'
        character.stand.speed = 'D'
        character.stand.range = 'D'
        character.stand.durability = 'F'
        character.stand.precision = 'F'
        character.stand.development = 'F'
        character.stand.save()
        character.stress = 8
        with self.assertRaisesMessage(ValidationError, 'A level 1 character must have exactly 5 abilities'):
            character.full_clean()

    def test_no_a_rank_abilities(self):
        character = self._create_valid_level_1_character()
        # Already has no A-ranks (C, D, D, C, D, F) and 3 abilities
        try:
            character.full_clean()
            self.assertTrue(True)
        except ValidationError as e:
            self.fail(f"No A-rank abilities test failed with ValidationError: {e.message_dict}")

    def test_s_rank_stand_stat_validation_denied_by_default(self):
        character = self._create_valid_level_1_character()
        # 6 points with S: S(5)+D(1)+F+F+F+F = 6. Minimum one D satisfies F-rank rule.
        character.stand.power = 'S'
        character.stand.speed = 'D'
        character.stand.range = 'F'
        character.stand.durability = 'F'
        character.stand.precision = 'F'
        character.stand.development = 'F'
        character.stand.save()
        with self.assertRaisesMessage(ValidationError, 'Player characters cannot have S-rank'):
            character.full_clean()

    def test_s_rank_stand_stat_validation_allowed_by_gm(self):
        character = self._create_valid_level_1_character()
        character.gm_can_have_s_rank_stand_stats = True
        character.stress = 8  # S+D+F+F+F+F => durability F => stress 8
        character.stand.power = 'S'
        character.stand.speed = 'D'
        character.stand.range = 'F'
        character.stand.durability = 'F'
        character.stand.precision = 'F'
        character.stand.development = 'F'
        character.stand.save()
        try:
            character.full_clean()
            self.assertTrue(True)
        except ValidationError as e:
            self.fail(f"S-rank allowed by GM failed with ValidationError: {e.message_dict}")

    def test_s_rank_stand_stat_validation_no_s_rank(self):
        character = self._create_valid_level_1_character()
        # Stand already has 6 points and no A/S ranks; full_clean should pass.
        try:
            character.full_clean()
            self.assertTrue(True)
        except ValidationError as e:
            self.fail(f"No S-rank validation failed with ValidationError: {e.message_dict}")

    
