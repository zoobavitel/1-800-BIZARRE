from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from characters.models import Campaign, Crew, Character

class CrewNameConsensusTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        self.player1 = User.objects.create_user(username='player1', email='player1@test.com', password='testpass')
        self.player2 = User.objects.create_user(username='player2', email='player2@test.com', password='testpass')

        self.campaign = Campaign.objects.create(name='Test Campaign', gm=self.gm_user)
        self.campaign.players.add(self.player1, self.player2)

        self.crew = Crew.objects.create(name='Old Crew Name', campaign=self.campaign)
        self.char1 = Character.objects.create(true_name='Char1', user=self.player1, campaign=self.campaign, crew=self.crew)
        self.char2 = Character.objects.create(true_name='Char2', user=self.player2, campaign=self.campaign, crew=self.crew)

    def _get_auth_client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_gm_can_change_crew_name_directly(self):
        client = self._get_auth_client(self.gm_user)
        response = client.patch(f'/api/crews/{self.crew.id}/', {'name': 'New Name by GM'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.name, 'New Name by GM')

    def test_player_cannot_change_crew_name_directly(self):
        client = self._get_auth_client(self.player1)
        response = client.patch(f'/api/crews/{self.crew.id}/', {'name': 'New Name by Player'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Crew name can only be changed by consensus or by the GM.', str(response.data['name']))
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.name, 'Old Crew Name')

    def test_player_proposes_name(self):
        client = self._get_auth_client(self.player1)
        response = client.post(f'/api/crews/{self.crew.id}/propose-name/', {'new_name': 'Proposed Crew Name'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.proposed_name, 'Proposed Crew Name')
        self.assertEqual(self.crew.proposed_by, self.player1)
        self.assertIn(self.player1, self.crew.approved_by.all())
        self.assertNotIn(self.player2, self.crew.approved_by.all())

    def test_non_member_cannot_propose_name(self):
        non_member = User.objects.create_user(username='nonmember', email='nonmember@test.com', password='testpass')
        client = self._get_auth_client(non_member)
        response = client.post(f'/api/crews/{self.crew.id}/propose-name/', {'new_name': 'Bad Proposal'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('You are not a member of this crew.', str(response.data['error']))

    def test_player_approves_name(self):
        # Player 1 proposes
        client1 = self._get_auth_client(self.player1)
        client1.post(f'/api/crews/{self.crew.id}/propose-name/', {'new_name': 'Consensus Name'}, format='json')
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.name, 'Old Crew Name') # Name should not change yet

        # Player 2 approves
        client2 = self._get_auth_client(self.player2)
        response = client2.post(f'/api/crews/{self.crew.id}/approve-name/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.name, 'Consensus Name') # Name should now change
        self.assertIsNone(self.crew.proposed_name)
        self.assertIsNone(self.crew.proposed_by)
        self.assertEqual(self.crew.approved_by.count(), 0)

    def test_player_approves_no_active_proposal(self):
        client = self._get_auth_client(self.player1)
        response = client.post(f'/api/crews/{self.crew.id}/approve-name/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('No name proposal is active.', str(response.data['error']))

    def test_non_member_cannot_approve_name(self):
        # Player 1 proposes
        client1 = self._get_auth_client(self.player1)
        client1.post(f'/api/crews/{self.crew.id}/propose-name/', {'new_name': 'Consensus Name'}, format='json')

        non_member = User.objects.create_user(username='nonmember2', email='nonmember2@test.com', password='testpass')
        client = self._get_auth_client(non_member)
        response = client.post(f'/api/crews/{self.crew.id}/approve-name/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('You are not a member of this crew.', str(response.data['error']))

    def test_partial_approval(self):
        # Player 1 proposes
        client1 = self._get_auth_client(self.player1)
        response = client1.post(f'/api/crews/{self.crew.id}/propose-name/', {'new_name': 'Partial Name'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Waiting for other members to approve.', str(response.data['message']))
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.name, 'Old Crew Name')
        self.assertEqual(self.crew.proposed_name, 'Partial Name')
        self.assertIn(self.player1, self.crew.approved_by.all())
        self.assertNotIn(self.player2, self.crew.approved_by.all())

    def test_gm_can_override_proposal(self):
        # Player 1 proposes
        client1 = self._get_auth_client(self.player1)
        client1.post(f'/api/crews/{self.crew.id}/propose-name/', {'new_name': 'Proposed Name'}, format='json')

        # GM changes name directly
        gm_client = self._get_auth_client(self.gm_user)
        response = gm_client.patch(f'/api/crews/{self.crew.id}/', {'name': 'GM Overridden Name'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.name, 'GM Overridden Name')
        self.assertIsNone(self.crew.proposed_name) # Proposal should be cleared
        self.assertIsNone(self.crew.proposed_by)
        self.assertEqual(self.crew.approved_by.count(), 0)

    def test_only_players_with_characters_in_crew_count_for_consensus(self):
        # Create a player with no character in this crew
        player_no_char = User.objects.create_user(username='player_no_char', email='player_no_char@test.com', password='testpass')
        self.campaign.players.add(player_no_char)

        # Player 1 proposes
        client1 = self._get_auth_client(self.player1)
        client1.post(f'/api/crews/{self.crew.id}/propose-name/', {'new_name': 'Consensus Name 2'}, format='json')
        self.crew.refresh_from_db()

        # Player 2 approves
        client2 = self._get_auth_client(self.player2)
        response = client2.post(f'/api/crews/{self.crew.id}/approve-name/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.crew.refresh_from_db()
        # The name should change because only player1 and player2 have characters in the crew
        self.assertEqual(self.crew.name, 'Consensus Name 2')
        self.assertIsNone(self.crew.proposed_name)
        self.assertIsNone(self.crew.proposed_by)
        self.assertEqual(self.crew.approved_by.count(), 0)

    def test_player_cannot_approve_twice(self):
        # Player 1 proposes
        client1 = self._get_auth_client(self.player1)
        client1.post(f'/api/crews/{self.crew.id}/propose-name/', {'new_name': 'Double Approve'}, format='json')
        self.crew.refresh_from_db()

        # Player 1 tries to approve again (should not add duplicate approval)
        response = client1.post(f'/api/crews/{self.crew.id}/approve-name/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.approved_by.count(), 1) # Still only 1 approval
        self.assertEqual(self.crew.name, 'Old Crew Name') # Name should not change

        # Player 2 approves to complete consensus
        client2 = self._get_auth_client(self.player2)
        response = client2.post(f'/api/crews/{self.crew.id}/approve-name/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.name, 'Double Approve')

