"""A crew is deleted only when its campaign has no players left (user's rule,
2026-10-29). The campaign's own delete still removes its crews. Staff may
delete any time, for cleanup."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Crew


class CrewDeleteRuleTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="cdr_gm", password="pw-cdr-gm-1")
        self.player = User.objects.create_user(username="cdr_player", password="pw-cdr-player-1")
        self.staff = User.objects.create_user(username="cdr_staff", password="pw-cdr-staff-1", is_staff=True)
        self.campaign = Campaign.objects.create(name="Crew Rule Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        self.crew = Crew.objects.create(name="Rule Crew", campaign=self.campaign)
        self.client = APIClient()

    def delete_as(self, user):
        self.client.force_authenticate(user)
        return self.client.delete(f"/api/crews/{self.crew.id}/")

    def test_gm_cannot_delete_while_players_remain(self):
        response = self.delete_as(self.gm)
        self.assertEqual(response.status_code, 409, getattr(response, "data", None))
        self.assertIn("Remove all players", str(response.data))
        self.assertTrue(Crew.objects.filter(pk=self.crew.pk).exists())

    def test_gm_can_delete_once_no_players_remain(self):
        self.campaign.players.clear()
        self.assertEqual(self.delete_as(self.gm).status_code, 204)
        self.assertFalse(Crew.objects.filter(pk=self.crew.pk).exists())

    def test_staff_can_delete_any_time(self):
        self.assertEqual(self.delete_as(self.staff).status_code, 204)

    def test_a_player_still_cannot_delete(self):
        self.assertEqual(self.delete_as(self.player).status_code, 403)
