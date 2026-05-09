"""POST /characters/{id}/roll-action/ with pool_source stand_coin (SRD_DEV)."""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from characters.models import Campaign, Character, Crew, Heritage, Session


class RollActionStandCoinTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="actor_sc", password="pass")
        self.gm = User.objects.create_user(username="gm_sc", password="pass")
        self.campaign = Campaign.objects.create(name="StandCoin Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="StandCoin Crew", campaign=self.campaign)
        self.h, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "test"},
        )
        dots = {
            "hunt": 1,
            "study": 0,
            "survey": 0,
            "tinker": 0,
            "finesse": 0,
            "prowl": 0,
            "skirmish": 3,
            "wreck": 0,
            "bizarre": 0,
            "command": 0,
            "consort": 0,
            "sway": 0,
        }
        self.actor = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Actor SC",
            heritage=self.h,
            action_dots=dots,
            stress=5,
            coin_stats={
                "power": "A",
                "speed": "C",
                "range": "D",
                "durability": "B",
                "precision": "D",
                "development": "D",
            },
        )
        self.session = Session.objects.create(campaign=self.campaign, name="StandCoin S1")

    def test_stand_coin_speed_uses_grade_not_skirmish_dots(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/characters/{self.actor.id}/roll-action/"
        r = self.client.post(
            url,
            {
                "action": "stand_speed",
                "session_id": self.session.id,
                "pool_source": "stand_coin",
                "stand_stat": "speed",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["rating"], 2)
        self.assertEqual(r.data["total_dice"], 2)

    def test_stand_coin_rejects_ripple_push(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/characters/{self.actor.id}/roll-action/"
        r = self.client.post(
            url,
            {
                "action": "stand_power",
                "session_id": self.session.id,
                "pool_source": "stand_coin",
                "stand_stat": "power",
                "push_dice": True,
                "ripple_breathing_free_push": True,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Ripple Breathing does not apply", str(r.data.get("error", "")))

    def test_stand_coin_requires_stat(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/characters/{self.actor.id}/roll-action/"
        r = self.client.post(
            url,
            {
                "action": "hunt",
                "session_id": self.session.id,
                "pool_source": "stand_coin",
                "stand_stat": "",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
