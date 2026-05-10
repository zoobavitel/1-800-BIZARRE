"""POST /characters/{id}/roll-action/ npc_heal_fortune (coin_boxes + session NPC healer)."""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from characters.models import (
    Campaign,
    Character,
    Crew,
    Heritage,
    NPC,
    Session,
    SessionNPCInvolvement,
)


class RollActionNpcHealFortuneTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm_nhf", password="pw")
        self.player = User.objects.create_user(username="pl_nhf", password="pw")
        self.campaign = Campaign.objects.create(name="NHF Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="NHF Crew", campaign=self.campaign)
        self.h, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "test"},
        )
        dots = {a: 0 for a in Character.ACTION_CATEGORIES["insight"]}
        dots.update({a: 0 for a in Character.ACTION_CATEGORIES["prowess"]})
        dots.update({a: 0 for a in Character.ACTION_CATEGORIES["resolve"]})
        dots["tinker"] = 2
        self.actor = Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Patient",
            heritage=self.h,
            action_dots=dots,
            coin_boxes=[True, True, True, False],
        )
        self.session = Session.objects.create(campaign=self.campaign, name="NHF S1")
        self.npc = NPC.objects.create(
            name="Field Medic",
            creator=self.gm,
            campaign=self.campaign,
            heritage=self.h,
        )
        SessionNPCInvolvement.objects.create(session=self.session, npc=self.npc)

    def test_npc_heal_fortune_zero_coin_does_not_touch_coin_boxes(self):
        self.client.force_authenticate(user=self.player)
        url = f"/api/characters/{self.actor.id}/roll-action/"
        r = self.client.post(
            url,
            {
                "roll_type": "FORTUNE",
                "session_id": self.session.id,
                "dice_pool": 2,
                "npc_heal_fortune": True,
                "npc_healer_npc_id": self.npc.id,
                "npc_heal_fortune_coin": 0,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("coin"), 3)
        self.assertEqual(r.data.get("total_dice"), 2)
        self.actor.refresh_from_db()
        self.assertEqual(sum(1 for x in self.actor.coin_boxes if x), 3)

    def test_npc_heal_fortune_spends_coin_boxes_and_caps_pool(self):
        self.client.force_authenticate(user=self.player)
        url = f"/api/characters/{self.actor.id}/roll-action/"
        r = self.client.post(
            url,
            {
                "roll_type": "FORTUNE",
                "session_id": self.session.id,
                "dice_pool": 4,
                "npc_heal_fortune": True,
                "npc_healer_npc_id": self.npc.id,
                "npc_heal_fortune_coin": 3,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("total_dice"), 6)
        self.assertEqual(r.data.get("coin"), 0)
        self.actor.refresh_from_db()
        self.assertEqual(sum(1 for x in self.actor.coin_boxes if x), 0)

    def test_npc_heal_fortune_forbidden_for_wrong_user(self):
        other = User.objects.create_user(username="other_nhf", password="pw")
        self.client.force_authenticate(user=other)
        url = f"/api/characters/{self.actor.id}/roll-action/"
        r = self.client.post(
            url,
            {
                "roll_type": "FORTUNE",
                "session_id": self.session.id,
                "dice_pool": 2,
                "npc_heal_fortune": True,
                "npc_healer_npc_id": self.npc.id,
                "npc_heal_fortune_coin": 1,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
