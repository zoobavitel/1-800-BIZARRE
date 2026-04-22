"""roll_action rejects more than one of push_effect, push_dice, devil_bargain_dice."""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from characters.models import Campaign, Character, Crew, Session, Heritage


class RollActionPushExclusiveTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="actor_pe", password="pass")
        self.gm = User.objects.create_user(username="gm_pe", password="pass")
        self.campaign = Campaign.objects.create(name="PushEx Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="PushEx Crew", campaign=self.campaign)
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
            true_name="Actor PE",
            heritage=self.h,
            action_dots=dots,
            stress=6,
        )
        self.session = Session.objects.create(
            campaign=self.campaign, name="PushEx S1"
        )

    def test_rejects_push_effect_and_push_dice_together(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/characters/{self.actor.id}/roll-action/"
        r = self.client.post(
            url,
            {
                "action": "hunt",
                "session_id": self.session.id,
                "push_effect": True,
                "push_dice": True,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Choose only one", str(r.data.get("error", "")))

    def test_allows_single_push_effect(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/characters/{self.actor.id}/roll-action/"
        r = self.client.post(
            url,
            {
                "action": "hunt",
                "session_id": self.session.id,
                "push_effect": True,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
