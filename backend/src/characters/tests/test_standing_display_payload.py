"""Campaign crew faction_relationships + NPCSummarySerializer.crew_standing."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Crew, CrewFactionRelationship, Faction, NPC


class StandingDisplayPayloadTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user("sd_gm", "sd_gm@test.com", "pw")
        self.player = User.objects.create_user("sd_pl", "sd_pl@test.com", "pw")
        self.campaign = Campaign.objects.create(name="Standing Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        self.pc = Character.objects.create(
            true_name="PC",
            user=self.player,
            campaign=self.campaign,
        )
        self.crew = Crew.objects.create(name="The Best Around", campaign=self.campaign)
        self.faction = Faction.objects.create(
            name="Dirty Deeds",
            campaign=self.campaign,
            visible_to_players=True,
            players_see_reputation=True,
            players_see_npcs=True,
        )
        self.hidden_faction = Faction.objects.create(
            name="Secret Cabal",
            campaign=self.campaign,
            visible_to_players=False,
            players_see_reputation=True,
        )
        CrewFactionRelationship.objects.create(
            crew=self.crew,
            faction=self.faction,
            reputation_value=-3,
        )
        CrewFactionRelationship.objects.create(
            crew=self.crew,
            faction=self.hidden_faction,
            reputation_value=2,
        )
        self.npc = NPC.objects.create(
            name="Mole",
            campaign=self.campaign,
            faction=self.faction,
            creator=self.gm,
            visible_to_players=True,
            crew_standing={str(self.crew.id): 3},
            pc_standing={str(self.pc.id): 2},
        )
        self.campaign_url = f"/api/campaigns/{self.campaign.id}/"
        self.faction_url = f"/api/factions/{self.faction.id}/"

    def test_gm_campaign_crews_include_faction_relationships(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        r = client.get(self.campaign_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        crews = r.data.get("crews") or []
        self.assertEqual(len(crews), 1)
        rels = crews[0].get("faction_relationships") or []
        by_name = {row.get("faction_name"): row.get("reputation_value") for row in rels}
        self.assertEqual(by_name.get("Dirty Deeds"), -3)
        self.assertEqual(by_name.get("Secret Cabal"), 2)

    def test_player_campaign_crews_omit_hidden_faction_relationships(self):
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.get(self.campaign_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        crews = r.data.get("crews") or []
        self.assertEqual(len(crews), 1)
        rels = crews[0].get("faction_relationships") or []
        names = {row.get("faction_name") for row in rels}
        self.assertIn("Dirty Deeds", names)
        self.assertNotIn("Secret Cabal", names)
        dirty = next(row for row in rels if row.get("faction_name") == "Dirty Deeds")
        self.assertEqual(dirty.get("reputation_value"), -3)

    def test_player_redacts_reputation_when_players_see_reputation_false(self):
        self.faction.players_see_reputation = False
        self.faction.save(update_fields=["players_see_reputation"])
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.get(self.campaign_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        rels = (r.data.get("crews") or [{}])[0].get("faction_relationships") or []
        dirty = next(row for row in rels if row.get("faction_name") == "Dirty Deeds")
        self.assertIsNone(dirty.get("reputation_value"))

    def test_npc_summary_includes_crew_and_pc_standing(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        r = client.get(self.faction_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        npcs = r.data.get("npcs") or []
        self.assertEqual(len(npcs), 1)
        self.assertEqual(npcs[0].get("crew_standing"), {str(self.crew.id): 3})
        self.assertEqual(npcs[0].get("pc_standing"), {str(self.pc.id): 2})

        r = client.get(self.campaign_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        camp_npcs = r.data.get("campaign_npcs") or []
        mole = next(n for n in camp_npcs if n.get("name") == "Mole")
        self.assertEqual(mole.get("crew_standing"), {str(self.crew.id): 3})
        self.assertEqual(mole.get("pc_standing"), {str(self.pc.id): 2})
