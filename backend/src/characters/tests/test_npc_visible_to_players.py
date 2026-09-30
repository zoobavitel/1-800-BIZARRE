"""NPC.visible_to_players + campaign_npcs / faction.npcs filtering for players."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Faction, NPC


class NpcVisibleToPlayersTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user("nv_gm", "nv_gm@test.com", "pw")
        self.player = User.objects.create_user("nv_pl", "nv_pl@test.com", "pw")
        self.campaign = Campaign.objects.create(name="NPC Vis Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        Character.objects.create(
            true_name="PC",
            user=self.player,
            campaign=self.campaign,
        )
        self.faction = Faction.objects.create(
            name="Revealed Faction",
            campaign=self.campaign,
            visible_to_players=True,
            players_see_npcs=True,
        )
        self.hidden_faction = Faction.objects.create(
            name="Hidden Faction",
            campaign=self.campaign,
            visible_to_players=False,
            players_see_npcs=True,
        )
        self.seen_npc = NPC.objects.create(
            name="Seen NPC",
            campaign=self.campaign,
            faction=self.faction,
            creator=self.gm,
            visible_to_players=True,
        )
        self.hidden_npc = NPC.objects.create(
            name="Hidden Member",
            campaign=self.campaign,
            faction=self.faction,
            creator=self.gm,
            visible_to_players=False,
        )
        self.hidden_fac_npc = NPC.objects.create(
            name="In Hidden Faction",
            campaign=self.campaign,
            faction=self.hidden_faction,
            creator=self.gm,
            visible_to_players=True,
        )
        self.orphan = NPC.objects.create(
            name="Unaffiliated",
            campaign=self.campaign,
            faction=None,
            creator=self.gm,
            visible_to_players=True,
        )
        self.campaign_url = f"/api/campaigns/{self.campaign.id}/"
        self.faction_url = f"/api/factions/{self.faction.id}/"

    def test_gm_sees_all_campaign_npcs_and_can_patch(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        r = client.get(self.campaign_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        names = {n["name"] for n in (r.data.get("campaign_npcs") or [])}
        self.assertEqual(
            names,
            {"Seen NPC", "Hidden Member", "In Hidden Faction", "Unaffiliated"},
        )
        patch = client.patch(
            f"/api/npcs/{self.seen_npc.id}/",
            {"visible_to_players": False},
            format="json",
        )
        self.assertEqual(patch.status_code, status.HTTP_200_OK, patch.data)
        self.seen_npc.refresh_from_db()
        self.assertFalse(self.seen_npc.visible_to_players)

    def test_player_campaign_npcs_filtered(self):
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.get(self.campaign_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        names = {n["name"] for n in (r.data.get("campaign_npcs") or [])}
        self.assertEqual(names, {"Seen NPC"})

    def test_player_faction_npcs_omit_hidden_members(self):
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.get(self.faction_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        names = {n["name"] for n in (r.data.get("npcs") or [])}
        self.assertEqual(names, {"Seen NPC"})

    def test_hide_all_members_via_patches(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        for npc_id in (self.seen_npc.id, self.hidden_npc.id):
            r = client.patch(
                f"/api/npcs/{npc_id}/",
                {"visible_to_players": False},
                format="json",
            )
            self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        client.force_authenticate(self.player)
        r = client.get(self.faction_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("npcs") or [], [])
        r = client.get(self.campaign_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("campaign_npcs") or [], [])
