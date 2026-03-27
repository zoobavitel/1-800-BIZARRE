"""Serializer tests: Spin/Hamon playbook abilities and required_a_count gating (spin_playbook_abilities_ui_86a86437)."""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from characters.models import Ability, Campaign, Character, Heritage, HamonAbility, SpinAbility, Vice
from characters.serializers import CharacterSerializer


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
            spin_type='FOUNDATION',
            description='Needs 2 A',
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
            hamon_type='FOUNDATION',
            description='Needs 2 A',
            required_a_count=2,
        )
        self.char = Character.objects.create(
            user=self.user,
            true_name='Tester',
            heritage=self.heritage,
            playbook='SPIN',
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

    def test_spin_ability_succeeds_when_count_a_meets_required(self):
        """Selecting a Spin ability with required_a_count=2 when coin_stats has 2 A grades succeeds."""
        data = {
            'coin_stats': {
                'power': 'A',
                'speed': 'A',
                'range': 'F',
                'durability': 'F',
                'precision': 'F',
                'development': 'F',
            },
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

    def test_spin_ability_fails_when_insufficient_a_count(self):
        """Spin ability with required_a_count=2 fails when count_A is 0."""
        data = {
            'coin_stats': {
                'power': 'F',
                'speed': 'F',
                'range': 'F',
                'durability': 'F',
                'precision': 'F',
                'development': 'F',
            },
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
        self.assertIn('Insufficient', err)
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
        self.assertIn('Spin abilities require playbook SPIN.', str(serializer.errors['non_field_errors'][0]))

    def test_hamon_ability_fails_when_insufficient_a_count(self):
        hamon_char = Character.objects.create(
            user=self.user,
            true_name='Hamon',
            heritage=self.heritage,
            playbook='HAMON',
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
        self.assertIn('Hamon abilities require playbook HAMON.', str(serializer.errors['non_field_errors'][0]))

    def test_create_character_with_spin_abilities_via_api(self):
        """POST /api/characters/ assigns user in perform_create; spin abilities persist when prereqs met."""
        client = APIClient()
        client.force_authenticate(user=self.user)
        vice = Vice.objects.create(name='ViceSpinCreate')
        campaign = Campaign.objects.create(name='C', gm=self.user)
        a1 = Ability.objects.create(name='Ability 1', type='standard', description='d')
        a2 = Ability.objects.create(name='Ability 2', type='standard', description='d')
        a3 = Ability.objects.create(name='Ability 3', type='standard', description='d')
        payload = {
            'true_name': 'New Spin',
            'playbook': 'SPIN',
            'campaign': campaign.id,
            'heritage': self.heritage.id,
            'vice': vice.id,
            'coin_stats': {
                'power': 'A',
                'speed': 'A',
                'range': 'F',
                'durability': 'F',
                'precision': 'F',
                'development': 'F',
            },
            'action_dots': {
                'hunt': 1,
                'study': 1,
                'survey': 1,
                'tinker': 1,
                'finesse': 1,
                'prowl': 1,
                'skirmish': 0,
                'wreck': 0,
                'bizarre': 0,
                'command': 0,
                'consort': 0,
                'sway': 0,
            },
            'stress': 0,
            'trauma': [],
            'xp_clocks': {},
            'spin_ability_ids': [self.spin_gated.id],
            'standard_abilities': [a1.id, a2.id, a3.id],
        }
        response = client.post('/api/characters/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        cid = response.data['id']
        character = Character.objects.get(pk=cid)
        self.assertEqual(character.playbook, 'SPIN')
        self.assertEqual(character.spin_abilities.count(), 1)
        self.assertEqual(character.spin_abilities.first().spin_ability_id, self.spin_gated.id)
