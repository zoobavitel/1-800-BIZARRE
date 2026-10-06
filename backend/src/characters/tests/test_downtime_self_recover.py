"""Downtime self-recover: no stress, pool ignores harm flags."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Crew, Heritage, Session


class DowntimeSelfRecoverTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="recover_pc", password="pass")
        self.gm = User.objects.create_user(username="recover_gm", password="pass")
        self.campaign = Campaign.objects.create(name="Recover Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="Recover Crew", campaign=self.campaign)
        self.h, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "test"},
        )
        dots = {
            "hunt": 0,
            "study": 0,
            "survey": 0,
            "tinker": 2,
            "finesse": 0,
            "prowl": 0,
            "skirmish": 0,
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
            true_name="Recover PC",
            heritage=self.h,
            action_dots=dots,
            stress=4,
            harm_level1_used=True,
            harm_level1_name="Bruised",
            harm_level2_used=True,
            harm_level2_name="Sprain",
            harm_level3_used=True,
            harm_level3_name="Broken rib",
        )
        self.session = Session.objects.create(
            campaign=self.campaign, name="Recover S1"
        )
        self.campaign.active_session = self.session
        self.campaign.save(update_fields=["active_session"])
        self.url = f"/api/characters/{self.actor.id}/roll-action/"

    def test_downtime_self_recover_no_stress_full_tinker_pool(self):
        self.client.force_authenticate(user=self.user)
        r = self.client.post(
            self.url,
            {
                "action": "tinker",
                "session_id": self.session.id,
                "recovery_context": "self_downtime",
                "bonus_dice": 0,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("stress_spent"), 0)
        self.assertEqual(r.data.get("total_dice"), 2)
        self.assertEqual(r.data.get("rating"), 2)
        self.actor.refresh_from_db()
        self.assertEqual(self.actor.stress, 4)

    def test_mid_action_self_recover_still_costs_two_stress(self):
        self.client.force_authenticate(user=self.user)
        r = self.client.post(
            self.url,
            {
                "action": "tinker",
                "session_id": self.session.id,
                "recovery_context": "self_mid_action",
                "bonus_dice": 0,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("stress_spent"), 2)
        self.actor.refresh_from_db()
        self.assertEqual(self.actor.stress, 6)

    def test_downtime_self_recover_ok_when_stress_track_full(self):
        self.actor.stress = 9
        self.actor.save(update_fields=["stress"])
        self.client.force_authenticate(user=self.user)
        r = self.client.post(
            self.url,
            {
                "action": "tinker",
                "session_id": self.session.id,
                "recovery_context": "self_downtime",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("stress_spent"), 0)
        self.actor.refresh_from_db()
        self.assertEqual(self.actor.stress, 9)
