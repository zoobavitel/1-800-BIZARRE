"""CharacterViewSet queryset: GM+player accounts see own PCs and campaign tables."""
from django.test import TestCase
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework.test import APIClient
from rest_framework import status

from characters.models import Campaign, Character, Heritage


def _list_rows(response):
    """Normalize DRF list response (plain list or paginated { results: [...] })."""
    data = response.data
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    raise AssertionError(f'Unexpected characters list response: {type(data)}')


class CharacterViewSetQuerysetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm_player = User.objects.create_user(username='gmp', password='testpass123')
        self.other_gm = User.objects.create_user(username='ogm', password='testpass123')
        self.c_as_gm = Campaign.objects.create(name='Campaign I GM', gm=self.gm_player)
        self.c_as_player = Campaign.objects.create(name='Campaign I play in', gm=self.other_gm)
        self.heritage = Heritage.objects.create(name='Human', base_hp=0, description='')

        # PC owned by gmp_player in someone else's campaign
        self.pc_elsewhere = Character.objects.create(
            user=self.gm_player,
            campaign=self.c_as_player,
            true_name='My PC in another game',
            heritage=self.heritage,
        )
        # Another user's PC in a campaign this user GMs
        self.player = User.objects.create_user(username='playeronly', password='testpass123')
        self.pc_at_my_table = Character.objects.create(
            user=self.player,
            campaign=self.c_as_gm,
            true_name='Player at my table',
            heritage=self.heritage,
        )

    def test_gm_who_also_plays_sees_own_pc_and_chars_in_gm_campaigns(self):
        self.assertIsNotNone(self.pc_at_my_table.campaign_id)
        self.assertEqual(
            Character.objects.filter(
                Q(user=self.gm_player) | Q(campaign__gm=self.gm_player)
            ).distinct().count(),
            2,
        )
        self.client.force_authenticate(user=self.gm_player)
        response = self.client.get('/api/characters/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = _list_rows(response)
        self.assertEqual(len(rows), 2)
        ids = {row['id'] for row in rows}
        self.assertIn(self.pc_elsewhere.id, ids)
        self.assertIn(self.pc_at_my_table.id, ids)

    def test_mine_param_returns_only_owned_characters(self):
        """?mine=true must never return characters owned by other users, even for GMs."""
        self.client.force_authenticate(user=self.gm_player)
        response = self.client.get('/api/characters/?mine=true')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = _list_rows(response)
        ids = {row['id'] for row in rows}
        # Only the GM's own character should appear, not the player's character.
        self.assertIn(self.pc_elsewhere.id, ids)
        self.assertNotIn(self.pc_at_my_table.id, ids)

    def test_gm_updating_player_character_does_not_change_ownership(self):
        """A GM can update a player's character sheet but must not become the owner."""
        self.client.force_authenticate(user=self.gm_player)
        url = f'/api/characters/{self.pc_at_my_table.id}/'
        payload = {'true_name': 'Updated by GM', 'heritage': self.heritage.id}
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pc_at_my_table.refresh_from_db()
        # Ownership must still belong to the original player, not the GM.
        self.assertEqual(self.pc_at_my_table.user_id, self.player.id)
        self.assertNotEqual(self.pc_at_my_table.user_id, self.gm_player.id)
