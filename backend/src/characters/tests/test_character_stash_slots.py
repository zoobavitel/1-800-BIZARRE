"""Character.stash_slots persists the 40-box stash when not using a campaign crew."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Heritage, Vice


def _stash_template():
    return [i == 5 for i in range(40)]


class CharacterStashSlotsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='stash_u', password='x')
        self.gm = User.objects.create_user(username='stash_gm', password='x')
        self.heritage = Heritage.objects.create(name='Human', base_hp=0, description='')
        self.vice = Vice.objects.create(name='StashV', description='')
        self.campaign = Campaign.objects.create(name='Stash Camp', gm=self.gm)
        dots = {k: 0 for k in (
            'hunt', 'study', 'survey', 'tinker', 'finesse', 'prowl', 'skirmish', 'wreck',
            'bizarre', 'command', 'consort', 'sway',
        )}
        self.char = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name='Stash Tester',
            heritage=self.heritage,
            vice=self.vice,
            playbook='STAND',
            action_dots=dots,
            coin_stats={
                'power': 'D', 'speed': 'D', 'range': 'D', 'durability': 'D',
                'precision': 'D', 'development': 'D',
            },
        )

    def test_patch_stash_slots_round_trip(self):
        slots = _stash_template()
        self.client.force_authenticate(user=self.user)
        r = self.client.patch(
            f'/api/characters/{self.char.id}/',
            {'stash_slots': slots},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.char.refresh_from_db()
        self.assertEqual(list(self.char.stash_slots), slots)
        self.assertTrue(self.char.stash_slots[5])
        self.assertFalse(self.char.stash_slots[0])
