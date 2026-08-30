"""Serializer tests: Spin/Hamon playbook abilities and character-level gating."""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from characters.models import Ability, Campaign, Character, Heritage, HamonAbility, SpinAbility, Vice
from characters.serializers import CharacterSerializer
from characters.services.xp_allocation import apply_level_up, apply_unlock_second_playbook


class SpinPlaybookAbilitySerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='spin_test_user', password='x')
        self.factory = APIRequestFactory()
        self.heritage = Heritage.objects.create(name='Test Heritage', base_hp=0)
        self.spin_foundation = SpinAbility.objects.create(
            name='Spin Foundation',
            spin_type='FOUNDATION',
            description='Foundational',
            required_a_count=0,
        )
        self.spin_gated = SpinAbility.objects.create(
            name='Spin Gated',
            spin_type='CAVALIER',
            description='Needs character level 2',
            required_a_count=2,
        )
        self.hamon_foundation = HamonAbility.objects.create(
            name='Hamon Foundation',
            hamon_type='FOUNDATION',
            description='Foundational',
            required_a_count=0,
        )
        self.hamon_gated = HamonAbility.objects.create(
            name='Hamon Gated',
            hamon_type='CAESAR_STYLE',
            description='Needs character level 2',
            required_a_count=2,
        )
        self.char = Character.objects.create(
            user=self.user,
            true_name='Tester',
            heritage=self.heritage,
            playbook='SPIN',
            level=1,
            coin_stats={
                'power': 'F',
                'speed': 'F',
                'range': 'F',
                'durability': 'F',
                'precision': 'F',
                'development': 'F',
            },
            action_dots={},
            trauma=[],
            xp_clocks={},
            stress=0,
        )

    def _request(self):
        req = self.factory.patch('/api/characters/')
        req.user = self.user
        return req

    def test_spin_ability_succeeds_when_level_meets_required(self):
        """Selecting a Spin ability with required_a_count=2 when level>=2 succeeds."""
        self.char.level = 2
        self.char.save(update_fields=['level'])
        data = {
            'playbook': 'SPIN',
            'spin_ability_ids': [self.spin_gated.id],
        }
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={'request': self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_spin_ability_fails_when_insufficient_level(self):
        """Spin ability with required_a_count=2 fails at character level 1."""
        data = {
            'playbook': 'SPIN',
            'spin_ability_ids': [self.spin_gated.id],
        }
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={'request': self._request()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)
        err = str(serializer.errors['non_field_errors'][0])
        self.assertIn('level', err.lower())
        self.assertIn('Spin Gated', err)

    def test_spin_abilities_rejected_when_playbook_not_spin(self):
        data = {
            'playbook': 'STAND',
            'spin_ability_ids': [self.spin_foundation.id],
        }
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={'request': self._request()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)
        self.assertIn('Spin abilities require playbook SPIN', str(serializer.errors['non_field_errors'][0]))

    def test_hamon_ability_fails_when_insufficient_level(self):
        hamon_char = Character.objects.create(
            user=self.user,
            true_name='Hamon',
            heritage=self.heritage,
            playbook='HAMON',
            level=1,
            coin_stats={k: 'F' for k in ['power', 'speed', 'range', 'durability', 'precision', 'development']},
            action_dots={},
            trauma=[],
            xp_clocks={},
            stress=0,
        )
        data = {
            'hamon_ability_ids': [self.hamon_gated.id],
            'playbook': 'HAMON',
        }
        serializer = CharacterSerializer(
            instance=hamon_char,
            data=data,
            partial=True,
            context={'request': self._request()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)
        err = str(serializer.errors['non_field_errors'][0])
        self.assertIn('Hamon Gated', err)

    def test_hamon_abilities_rejected_when_playbook_not_hamon(self):
        data = {
            'playbook': 'STAND',
            'hamon_ability_ids': [self.hamon_foundation.id],
        }
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={'request': self._request()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)
        self.assertIn('Hamon abilities require playbook HAMON', str(serializer.errors['non_field_errors'][0]))

    def test_partial_hamon_ids_without_playbook_uses_instance_playbook(self):
        """Omit playbook, send hamon_ability_ids — validate against instance.playbook."""
        hamon_char = Character.objects.create(
            user=self.user,
            true_name='HamonOmitPb',
            heritage=self.heritage,
            playbook='HAMON',
            level=2,
            coin_stats={
                'power': 'A',
                'speed': 'A',
                'range': 'F',
                'durability': 'F',
                'precision': 'F',
                'development': 'F',
            },
            action_dots={},
            trauma=[],
            xp_clocks={},
            stress=0,
        )
        data = {
            'hamon_ability_ids': [self.hamon_gated.id],
        }
        serializer = CharacterSerializer(
            instance=hamon_char,
            data=data,
            partial=True,
            context={'request': self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_partial_hamon_ids_without_playbook_rejects_stand_instance(self):
        """Omit playbook on STAND instance + hamon_ids → reject via instance playbook."""
        data = {
            'hamon_ability_ids': [self.hamon_foundation.id],
        }
        serializer = CharacterSerializer(
            instance=self.char,  # playbook SPIN in setUp; still not HAMON
            data=data,
            partial=True,
            context={'request': self._request()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)
        self.assertIn(
            'Hamon abilities require playbook HAMON',
            str(serializer.errors['non_field_errors'][0]),
        )

    def test_hamon_abilities_allowed_when_secondary_is_hamon(self):
        stand_char = Character.objects.create(
            user=self.user,
            true_name='StandPlusHamon',
            heritage=self.heritage,
            playbook='STAND',
            coin_stats={k: 'F' for k in ['power', 'speed', 'range', 'durability', 'precision', 'development']},
            action_dots={},
            trauma=[],
            xp_clocks={},
            stress=0,
            unallocated_xp=30,
        )
        apply_unlock_second_playbook(stand_char, secondary_playbook='HAMON')
        stand_char.refresh_from_db()
        serializer = CharacterSerializer(
            instance=stand_char,
            data={'hamon_ability_ids': [self.hamon_foundation.id]},
            partial=True,
            context={'request': self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_spin_abilities_allowed_when_secondary_is_spin(self):
        stand_char = Character.objects.create(
            user=self.user,
            true_name='StandPlusSpin',
            heritage=self.heritage,
            playbook='STAND',
            coin_stats={k: 'F' for k in ['power', 'speed', 'range', 'durability', 'precision', 'development']},
            action_dots={},
            trauma=[],
            xp_clocks={},
            stress=0,
            unallocated_xp=30,
        )
        apply_unlock_second_playbook(stand_char, secondary_playbook='SPIN')
        stand_char.refresh_from_db()
        serializer = CharacterSerializer(
            instance=stand_char,
            data={'spin_ability_ids': [self.spin_foundation.id]},
            partial=True,
            context={'request': self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_heritage_accepts_display_name_string(self):
        """PATCH may send heritage as display name (matches frontend before /heritages/ resolves)."""
        other = Heritage.objects.create(name='Rock Human', base_hp=2)
        data = {'heritage': 'Rock Human'}
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={'request': self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['heritage'], other)

    def test_create_character_with_spin_abilities_via_api(self):
        """POST /api/characters/ assigns user; L1 spin ability (required 0 or level met) persists."""
        client = APIClient()
        client.force_authenticate(user=self.user)
        vice = Vice.objects.create(name='ViceSpinCreate')
        campaign = Campaign.objects.create(name='C', gm=self.user)
        a1 = Ability.objects.create(name='Ability 1', type='standard', description='d')
        spin_l1 = SpinAbility.objects.create(
            name='Spin L1 Pick',
            spin_type='CAVALIER',
            description='Level 1',
            required_a_count=1,
        )
        payload = {
            'true_name': 'New Spin',
            'playbook': 'SPIN',
            'campaign': campaign.id,
            'heritage': self.heritage.id,
            'vice': vice.id,
            'level': 1,
            'coin_stats': {
                'power': 'D',
                'speed': 'D',
                'range': 'D',
                'durability': 'D',
                'precision': 'D',
                'development': 'D',
            },
            'action_dots': {
                'hunt': 1,
                'study': 1,
                'survey': 1,
                'tinker': 1,
                'finesse': 1,
                'prowl': 1,
                'skirmish': 1,
                'wreck': 0,
                'bizarre': 0,
                'command': 0,
                'consort': 0,
                'sway': 0,
            },
            'stress': 9,
            'trauma': [],
            'xp_clocks': {},
            'spin_ability_ids': [self.spin_foundation.id, spin_l1.id],
            'standard_abilities': [a1.id],
        }
        response = client.post('/api/characters/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        cid = response.data['id']
        character = Character.objects.get(pk=cid)
        self.assertEqual(character.playbook, 'SPIN')
        self.assertEqual(character.spin_abilities.count(), 2)

    def test_two_non_foundation_spin_abilities_rejected_at_l1(self):
        spin_l1_a = SpinAbility.objects.create(
            name='Spin L1 A',
            spin_type='CAVALIER',
            description='Level 1 A',
            required_a_count=1,
        )
        spin_l1_b = SpinAbility.objects.create(
            name='Spin L1 B',
            spin_type='EXECUTIONER',
            description='Level 1 B',
            required_a_count=1,
        )
        data = {
            'playbook': 'SPIN',
            'spin_ability_ids': [spin_l1_a.id, spin_l1_b.id],
        }
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={'request': self._request()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)
        self.assertIn('Playbook ability limit', str(serializer.errors['non_field_errors'][0]))

    def test_second_non_foundation_allowed_after_playbook_advance(self):
        spin_l1_a = SpinAbility.objects.create(
            name='Spin L1 A',
            spin_type='CAVALIER',
            description='Level 1 A',
            required_a_count=1,
        )
        spin_l1_b = SpinAbility.objects.create(
            name='Spin L1 B',
            spin_type='EXECUTIONER',
            description='Level 1 B',
            required_a_count=1,
        )
        self.char.xp_clocks = {'playbook': 10}
        self.char.save(update_fields=['xp_clocks'])
        apply_level_up(
            self.char,
            xp_track='playbook',
            choice='playbook_ability',
        )
        data = {
            'playbook': 'SPIN',
            'spin_ability_ids': [spin_l1_a.id, spin_l1_b.id],
        }
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={'request': self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
