"""Faction.faction_status_visibility player redact + normalize."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Faction
from characters.services.faction_status_visibility import (
    normalize_faction_status_visibility,
    peer_standing_visible,
    redact_faction_status_for_player,
)


class FactionStatusVisibilityNormalizeTests(TestCase):
    def test_normalize_coerces_bools(self):
        self.assertEqual(
            normalize_faction_status_visibility(
                {" Canary ": 1, "Dirty": 0, "next": True, "": False}
            ),
            {"Canary": True, "Dirty": False},
        )

    def test_peer_standing_visible_defaults_true(self):
        self.assertTrue(peer_standing_visible({}, "Canary"))
        self.assertFalse(peer_standing_visible({"Canary": False}, "Canary"))
        self.assertTrue(peer_standing_visible({"Canary": True}, "Canary"))

    def test_redact_drops_hidden(self):
        status = {"Canary": -3, "Dirty": 1, "Other": 0}
        vis = {"Canary": False, "Dirty": True}
        self.assertEqual(
            redact_faction_status_for_player(status, vis),
            {"Dirty": 1, "Other": 0},
        )


class FactionStatusVisibilityApiTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user("fsv_gm", "fsv_gm@test.com", "pw")
        self.player = User.objects.create_user("fsv_pl", "fsv_pl@test.com", "pw")
        self.campaign = Campaign.objects.create(name="FSV Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        Character.objects.create(
            true_name="PC",
            user=self.player,
            campaign=self.campaign,
        )
        self.canary = Faction.objects.create(
            name="Canary Men",
            campaign=self.campaign,
            visible_to_players=True,
            faction_status={"Dirty Deeds": -3, "Testacles": 0},
            faction_status_visibility={"Dirty Deeds": False, "Testacles": True},
        )
        self.dirty = Faction.objects.create(
            name="Dirty Deeds",
            campaign=self.campaign,
            visible_to_players=True,
            faction_status={"Canary Men": -3},
            faction_status_visibility={"Canary Men": False},
        )
        self.url = f"/api/factions/{self.canary.id}/"

    def test_gm_sees_hidden_edges(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        r = client.get(self.url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["faction_status"]["Dirty Deeds"], -3)
        self.assertFalse(r.data["faction_status_visibility"]["Dirty Deeds"])

    def test_player_redacts_hidden_edges(self):
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.get(self.url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        status_map = r.data.get("faction_status") or {}
        self.assertNotIn("Dirty Deeds", status_map)
        self.assertEqual(status_map.get("Testacles"), 0)
        vis = r.data.get("faction_status_visibility") or {}
        self.assertNotIn("Dirty Deeds", vis)

    def test_gm_can_patch_visibility(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        r = client.patch(
            self.url,
            {"faction_status_visibility": {"Dirty Deeds": True}},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.canary.refresh_from_db()
        self.assertTrue(self.canary.faction_status_visibility["Dirty Deeds"])
