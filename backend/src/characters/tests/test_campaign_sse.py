"""Campaign SSE endpoint: token auth and GM/player access."""
from django.test import Client, TestCase
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

from characters.models import Campaign


class CampaignSSEViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.gm = User.objects.create_user("gm", "gm@example.com", "pw")
        self.player = User.objects.create_user("pl", "pl@example.com", "pw")
        self.stranger = User.objects.create_user("st", "st@example.com", "pw")
        self.campaign = Campaign.objects.create(name="Test", gm=self.gm)
        self.campaign.players.add(self.player)
        self.player_token = Token.objects.create(user=self.player)
        self.stranger_token = Token.objects.create(user=self.stranger)

    def test_events_401_without_token(self):
        r = self.client.get(f"/api/campaigns/{self.campaign.id}/events/")
        self.assertEqual(r.status_code, 401)

    def test_events_403_for_non_member(self):
        r = self.client.get(
            f"/api/campaigns/{self.campaign.id}/events/?token={self.stranger_token.key}"
        )
        self.assertEqual(r.status_code, 403)

    def test_events_200_for_player(self):
        r = self.client.get(
            f"/api/campaigns/{self.campaign.id}/events/?token={self.player_token.key}"
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/event-stream", r.get("Content-Type", ""))
