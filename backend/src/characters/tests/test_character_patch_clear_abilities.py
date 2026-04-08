"""PATCH /api/characters/:id/ can clear standard, Hamon, and Spin abilities."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import (
    Ability,
    Campaign,
    Character,
    CharacterSpinAbility,
    Heritage,
    SpinAbility,
    Vice,
)


class CharacterPatchClearAbilitiesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='abil_clear_u', password='x')
        self.gm = User.objects.create_user(username='abil_clear_gm', password='x')
        self.heritage = Heritage.objects.create(name='Human', base_hp=0, description='')
        self.vice = Vice.objects.create(name='VClear', description='')
        self.campaign = Campaign.objects.create(name='Abil Camp', gm=self.gm)
        dots = {k: 0 for k in (
            'hunt', 'study', 'survey', 'tinker', 'finesse', 'prowl', 'skirmish', 'wreck',
            'bizarre', 'command', 'consort', 'sway',
        )}
        self.char = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name='Ability Tester',
            heritage=self.heritage,
            vice=self.vice,
            playbook='SPIN',
            action_dots=dots,
            coin_stats={
                'power': 'A', 'speed': 'A', 'range': 'F', 'durability': 'F',
                'precision': 'F', 'development': 'F',
            },
        )
        self.ab1 = Ability.objects.create(name='Std One', type='standard', description='')
        self.ab2 = Ability.objects.create(name='Std Two', type='standard', description='')
        self.char.standard_abilities.add(self.ab1, self.ab2)
        self.spin = SpinAbility.objects.create(
            name='Spin Foundation',
            spin_type='FOUNDATION',
            description='',
            required_a_count=0,
        )
        CharacterSpinAbility.objects.create(character=self.char, spin_ability=self.spin)

    def test_patch_empty_lists_clear_all_ability_links(self):
        self.client.force_authenticate(user=self.user)
        url = f'/api/characters/{self.char.id}/'
        r = self.client.patch(
            url,
            {
                'standard_abilities': [],
                'spin_ability_ids': [],
            },
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.char.refresh_from_db()
        self.assertEqual(self.char.standard_abilities.count(), 0)
        self.assertEqual(self.char.spin_abilities.count(), 0)
