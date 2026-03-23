"""CharacterViewSet queryset: GM+player accounts see own PCs and campaign tables."""
from django.test import TestCase
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework.test import APIClient
from rest_framework import status

from characters.models import Campaign, Character


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

        # PC owned by gmp_player in someone else's campaign
        self.pc_elsewhere = Character.objects.create(
            user=self.gm_player,
            campaign=self.c_as_player,
            true_name='My PC in another game',
        )
        # Another user's PC in a campaign this user GMs
        self.pc_at_my_table = Character.objects.create(
            user=User.objects.create_user(username='playeronly', password='testpass123'),
            campaign=self.c_as_gm,
            true_name='Player at my table',
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
