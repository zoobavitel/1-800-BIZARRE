"""roll_action with assist_helper_id: +1d and helper stress in one request."""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from characters.models import Campaign, Character, Crew, Session, Heritage


class RollActionAssistTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='actor_ra', password='pass')
        self.helper_user = User.objects.create_user(username='helper_ra', password='pass')
        self.gm = User.objects.create_user(username='gm_ra', password='pass')
        self.campaign = Campaign.objects.create(name='RollAssist Camp', gm=self.gm)
        self.crew = Crew.objects.create(name='RollAssist Crew', campaign=self.campaign)
        self.h, _ = Heritage.objects.get_or_create(
            name='Human',
            defaults={'base_hp': 0, 'description': 'test'},
        )
        dots = {
            'hunt': 1,
            'study': 0,
            'survey': 0,
            'tinker': 0,
            'finesse': 0,
            'prowl': 0,
            'skirmish': 0,
            'wreck': 0,
            'bizarre': 0,
            'command': 0,
            'consort': 0,
            'sway': 0,
        }
        self.actor = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            crew=self.crew,
            true_name='Actor RA',
            heritage=self.h,
            action_dots=dots,
            stress=5,
        )
        self.helper = Character.objects.create(
            user=self.helper_user,
            campaign=self.campaign,
            crew=self.crew,
            true_name='Helper RA',
            heritage=self.h,
            action_dots=dots,
            stress=5,
        )
        self.session = Session.objects.create(campaign=self.campaign, name='RollAssist S1')

    def test_assist_adds_die_and_deducts_helper_stress(self):
        self.client.force_authenticate(user=self.user)
        url = f'/api/characters/{self.actor.id}/roll-action/'
        r = self.client.post(
            url,
            {
                'action': 'hunt',
                'session_id': self.session.id,
                'assist_helper_id': self.helper.id,
            },
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['rating'], 1)
        # action_rating 1 + attribute_dice 1 (another insight action with dots would add more) + assist 1
        self.assertEqual(r.data['attribute_dice'], 1)
        self.assertEqual(r.data['total_dice'], 3)
        self.assertEqual(r.data['assist_helper_id'], self.helper.id)
        self.helper.refresh_from_db()
        self.assertEqual(self.helper.stress, 4)

    def test_assist_rejects_different_crew(self):
        other_crew = Crew.objects.create(name='Other', campaign=self.campaign)
        lone = Character.objects.create(
            user=self.helper_user,
            campaign=self.campaign,
            crew=other_crew,
            true_name='Lone',
            heritage=self.h,
            action_dots={'hunt': 0, 'study': 0, 'survey': 0, 'tinker': 0, 'finesse': 0, 'prowl': 0, 'skirmish': 0, 'wreck': 0, 'bizarre': 0, 'command': 0, 'consort': 0, 'sway': 0},
            stress=3,
        )
        self.client.force_authenticate(user=self.user)
        url = f'/api/characters/{self.actor.id}/roll-action/'
        r = self.client.post(
            url,
            {
                'action': 'hunt',
                'session_id': self.session.id,
                'assist_helper_id': lone.id,
            },
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
