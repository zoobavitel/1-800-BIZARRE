"""GET /api/site-stats/ aggregates playbooks and heritages (PCs + NPCs)."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Heritage


class SiteStatsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='stats_user', password='x')
        self.gm = User.objects.create_user(username='stats_gm', password='x')
        self.campaign = Campaign.objects.create(name='Stats Camp', gm=self.gm)
        self.h_human = Heritage.objects.create(name='Human', base_hp=0, description='')
        self.h_rock = Heritage.objects.create(name='Rock Human', base_hp=2, description='')
        self.h_vampire = Heritage.objects.create(name='Vampire', base_hp=0, description='')

        dots = {k: 0 for k in (
            'hunt', 'study', 'survey', 'tinker', 'finesse', 'prowl', 'skirmish', 'wreck',
            'bizarre', 'command', 'consort', 'sway',
        )}

        Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name='Stand One',
            heritage=self.h_human,
            playbook='STAND',
            action_dots=dots,
        )
        Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name='Stand Two',
            heritage=self.h_human,
            playbook='STAND',
            action_dots=dots,
        )
        Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name='Hamon One',
            heritage=self.h_rock,
            playbook='HAMON',
            action_dots=dots,
        )
        Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name='Spin One',
            heritage=self.h_vampire,
            playbook='SPIN',
            action_dots=dots,
        )

    def test_site_stats_requires_auth(self):
        r = self.client.get('/api/site-stats/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_site_stats_payload(self):
        self.client.force_authenticate(user=self.user)
        r = self.client.get('/api/site-stats/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(
            r.data['playbook_counts'],
            {'STAND': 2, 'HAMON': 1, 'SPIN': 1},
        )
        names = [h['name'] for h in r.data['top_heritages']]
        self.assertEqual(names, ['Human', 'Rock Human', 'Vampire'])
        self.assertEqual(r.data['top_heritages'][0]['count'], 2)
