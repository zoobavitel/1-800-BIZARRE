"""GM remove-player, withdraw-invitation, and GM unassign-character."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, CampaignInvitation, Character, Heritage


class CampaignGmPlayerManagementTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user("cgm", "cgm@test.com", "pw")
        self.player = User.objects.create_user("cpl", "cpl@test.com", "pw")
        self.other = User.objects.create_user("coth", "coth@test.com", "pw")
        self.campaign = Campaign.objects.create(name="C", gm=self.gm)
        self.campaign.players.add(self.player)
        self.heritage = Heritage.objects.create(
            name="Human", base_hp=0, description=""
        )
        self.pc = Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            true_name="PC One",
            heritage=self.heritage,
        )

    def test_remove_player_clears_characters_and_m2m(self):
        self.client.force_authenticate(self.gm)
        url = f"/api/campaigns/{self.campaign.id}/remove-player/"
        r = self.client.post(url, {"user_id": self.player.id}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.pc.refresh_from_db()
        self.assertIsNone(self.pc.campaign_id)
        self.assertFalse(self.campaign.players.filter(id=self.player.id).exists())

    def test_remove_player_403_for_non_gm(self):
        self.client.force_authenticate(self.player)
        url = f"/api/campaigns/{self.campaign.id}/remove-player/"
        r = self.client.post(url, {"user_id": self.player.id}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_remove_player_rejects_gm_id(self):
        self.client.force_authenticate(self.gm)
        url = f"/api/campaigns/{self.campaign.id}/remove-player/"
        r = self.client.post(url, {"user_id": self.gm.id}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_withdraw_invitation_deletes_pending(self):
        inv = CampaignInvitation.objects.create(
            campaign=self.campaign,
            invited_user=self.other,
            invited_by=self.gm,
            status="pending",
        )
        self.client.force_authenticate(self.gm)
        url = f"/api/campaigns/{self.campaign.id}/withdraw-invitation/"
        r = self.client.post(url, {"invitation_id": inv.id}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(CampaignInvitation.objects.filter(pk=inv.pk).exists())

    def test_gm_can_unassign_other_players_character(self):
        self.client.force_authenticate(self.gm)
        url = f"/api/campaigns/{self.campaign.id}/unassign-character/"
        r = self.client.post(url, {"character_id": self.pc.id}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.pc.refresh_from_db()
        self.assertIsNone(self.pc.campaign_id)
        self.assertFalse(self.campaign.players.filter(id=self.player.id).exists())
