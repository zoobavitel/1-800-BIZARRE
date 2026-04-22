from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Session


class SessionDateUpdateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm_date", password="pw")
        self.player = User.objects.create_user(username="player_date", password="pw")
        self.campaign = Campaign.objects.create(name="Date Campaign", gm=self.gm)
        self.campaign.players.add(self.player)
        self.session = Session.objects.create(campaign=self.campaign, name="Session 1")

    def test_gm_can_patch_session_date(self):
        self.client.force_authenticate(user=self.gm)
        res = self.client.patch(
            f"/api/sessions/{self.session.id}/",
            {"session_date": "2026-04-30T12:00:00Z"},
            format="json",
        )

        self.assertEqual(res.status_code, 200, res.data)
        self.session.refresh_from_db()
        self.assertEqual(self.session.session_date.date().isoformat(), "2026-04-30")
        self.assertEqual(res.data["session_date"][:10], "2026-04-30")

    def test_non_gm_cannot_patch_session_date(self):
        original_date = self.session.session_date
        self.client.force_authenticate(user=self.player)
        res = self.client.patch(
            f"/api/sessions/{self.session.id}/",
            {"session_date": "2026-05-01T12:00:00Z"},
            format="json",
        )

        self.assertEqual(res.status_code, 403)
        self.session.refresh_from_db()
        self.assertEqual(self.session.session_date, original_date)
