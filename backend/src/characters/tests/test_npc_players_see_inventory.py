"""NPC.players_see_inventory redacts inventory for non-GM viewers."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, NPC


class NpcPlayersSeeInventoryTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user("npsi_gm", "npsi_gm@test.com", "pw")
        self.player = User.objects.create_user("npsi_pl", "npsi_pl@test.com", "pw")
        self.campaign = Campaign.objects.create(name="Inv Vis Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        Character.objects.create(
            true_name="PC",
            user=self.player,
            campaign=self.campaign,
        )
        self.npc = NPC.objects.create(
            name="Stash NPC",
            campaign=self.campaign,
            creator=self.gm,
            visible_to_players=True,
            players_see_inventory=False,
            inventory=[{"name": "Secret blade", "load": 1}],
            items=["legacy item"],
            inventory_notes="hidden notes",
        )
        self.url = f"/api/npcs/{self.npc.id}/"

    def test_gm_sees_inventory(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        r = client.get(self.url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(len(r.data.get("inventory") or []), 1)
        self.assertEqual(r.data.get("items"), ["legacy item"])
        self.assertEqual(r.data.get("inventory_notes"), "hidden notes")
        self.assertFalse(r.data.get("players_see_inventory"))

    def test_player_inventory_redacted(self):
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.get(self.url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("inventory"), [])
        self.assertEqual(r.data.get("items"), [])
        self.assertEqual(r.data.get("inventory_notes"), "")

    def test_player_sees_inventory_when_flag_true(self):
        self.npc.players_see_inventory = True
        self.npc.save(update_fields=["players_see_inventory"])
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.get(self.url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(len(r.data.get("inventory") or []), 1)
