"""Faction per-field players_see_* visibility for non-GM viewers."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    Crew,
    CrewFactionRelationship,
    Faction,
    NPC,
)


class FactionPlayersSeeFieldsTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user("fps_gm", "fps_gm@test.com", "pw")
        self.player = User.objects.create_user("fps_pl", "fps_pl@test.com", "pw")
        self.campaign = Campaign.objects.create(name="Field Vis Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        # Faction/Crew querysets gate on campaign characters, not players M2M alone.
        Character.objects.create(
            true_name="PC",
            user=self.player,
            campaign=self.campaign,
        )
        self.faction = Faction.objects.create(
            name="Hidden Bits",
            campaign=self.campaign,
            level=3,
            hold="strong",
            reputation=2,
            notes="secret notes",
            visible_to_players=True,
            players_see_tier=False,
            players_see_hold=False,
            players_see_reputation=False,
            players_see_notes=False,
            players_see_npcs=False,
        )
        NPC.objects.create(
            name="Secret NPC",
            campaign=self.campaign,
            faction=self.faction,
            creator=self.gm,
        )
        self.crew = Crew.objects.create(name="Crew A", campaign=self.campaign)
        CrewFactionRelationship.objects.create(
            crew=self.crew,
            faction=self.faction,
            reputation_value=1,
            notes="link note",
        )
        self.faction_url = f"/api/factions/{self.faction.id}/"
        self.crew_url = f"/api/crews/{self.crew.id}/"

    def test_gm_sees_all_fields(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        r = client.get(self.faction_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["level"], 3)
        self.assertEqual(r.data["hold"], "strong")
        self.assertEqual(r.data["reputation"], 2)
        self.assertEqual(r.data["notes"], "secret notes")
        self.assertEqual(len(r.data.get("npcs") or []), 1)
        self.assertFalse(r.data["players_see_tier"])

    def test_player_fields_redacted(self):
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.get(self.faction_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertIsNone(r.data["level"])
        self.assertIsNone(r.data["hold"])
        self.assertIsNone(r.data["reputation"])
        self.assertEqual(r.data["notes"], "")
        self.assertEqual(r.data.get("npcs") or [], [])
        self.assertFalse(r.data["players_see_tier"])
        self.assertFalse(r.data["players_see_npcs"])

    def test_player_crew_relationships_honor_flags(self):
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.get(self.crew_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        rels = r.data.get("faction_relationships") or []
        self.assertEqual(len(rels), 1)
        row = rels[0]
        self.assertIsNone(row.get("reputation_value"))
        self.assertEqual(row.get("notes"), "")
        self.assertIsNone(row.get("faction_level"))
        self.assertIsNone(row.get("faction_hold"))
        self.assertIsNone(row.get("faction_reputation"))
        self.assertEqual(row.get("faction_notes"), "")
        self.assertFalse(row.get("players_see_reputation"))

    def test_gm_can_patch_field_flags(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        r = client.patch(
            self.faction_url,
            {
                "players_see_tier": True,
                "players_see_hold": True,
                "players_see_reputation": True,
                "players_see_notes": True,
                "players_see_npcs": True,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.faction.refresh_from_db()
        self.assertTrue(self.faction.players_see_tier)
        self.assertTrue(self.faction.players_see_npcs)
