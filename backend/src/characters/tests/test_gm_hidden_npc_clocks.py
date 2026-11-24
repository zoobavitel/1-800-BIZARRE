"""The GM sees clocks on an NPC hidden from players; players don't."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, NPC, ProgressClock


class GmHiddenNpcClockTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="hn_gm", password="pw-hn-gm-1")
        self.p1 = User.objects.create_user(username="hn_p1", password="pw-hn-p1-1")
        self.camp = Campaign.objects.create(name="HN", gm=self.gm)
        self.camp.players.add(self.p1)
        npc = NPC.objects.create(
            name="Secret", campaign=self.camp, creator=self.gm, visible_to_players=False
        )
        ProgressClock.objects.create(
            name="Secret plan",
            campaign=self.camp,
            npc=npc,
            created_by=self.gm,
            clock_type="CUSTOM",
            max_segments=4,
            visible_to_players=True,
        )
        self.client = APIClient()

    def _names(self, user):
        self.client.force_authenticate(user)
        data = self.client.get(f"/api/progress-clocks/?campaign={self.camp.id}").data
        rows = data if isinstance(data, list) else data.get("results", [])
        return {c["name"] for c in rows}

    def test_gm_sees_it(self):
        self.assertIn("Secret plan", self._names(self.gm))

    def test_player_does_not(self):
        self.assertNotIn("Secret plan", self._names(self.p1))
