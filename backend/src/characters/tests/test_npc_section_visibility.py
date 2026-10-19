"""Per-section NPC and faction visibility for non-GM viewers."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Crew, CrewFactionRelationship, Faction, NPC


class NpcSectionVisibilityTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user("sec_gm", "sec_gm@test.com", "pw")
        self.player = User.objects.create_user("sec_pl", "sec_pl@test.com", "pw")
        self.campaign = Campaign.objects.create(name="Section Vis", gm=self.gm)
        self.campaign.players.add(self.player)
        self.pc = Character.objects.create(
            true_name="PC",
            user=self.player,
            campaign=self.campaign,
        )
        self.crew = Crew.objects.create(name="Crew A", campaign=self.campaign)
        self.faction = Faction.objects.create(
            name="Passione",
            faction_type="Syndicate",
            campaign=self.campaign,
            visible_to_players=True,
            players_see_npcs=True,
            level=4,
            hold="strong",
            reputation=2,
            notes="gm faction notes",
            crew_notes="ops",
            inventory=[{"name": "Vault"}],
            contacts=[{"name": "Bruno"}],
            faction_status={"Speedwagon": 1},
        )
        CrewFactionRelationship.objects.create(
            crew=self.crew,
            faction=self.faction,
            reputation_value=2,
            notes="crew link",
        )
        hidden = {
            "playbook": False,
            "abilities": False,
            "pc_standing": False,
            "faction_membership": False,
            "notes": False,
            "stand_identity": False,
            "heritage": False,
            "forms": False,
            "consciousness": False,
            "contacts": False,
            "crew_standing": False,
        }
        self.npc = NPC.objects.create(
            name="Diavolo",
            stand_name="King Crimson",
            stand_description="erased time",
            playbook="STAND",
            notes="boss secret",
            campaign=self.campaign,
            faction=self.faction,
            creator=self.gm,
            visible_to_players=True,
            abilities=[{"name": "Epitaph", "description": "see ahead"}],
            custom_abilities="custom blurb",
            contacts=[{"name": "Doppio"}],
            pc_standing={str(self.pc.id): 2},
            crew_standing={str(self.crew.id): -1},
            stand_forms=["Humanoid"],
            stand_consciousness="A",
            stand_identity_types=["AUTOMATIC"],
            players_see=hidden,
        )
        self.pc.npc_standing = {str(self.npc.id): 2}
        self.pc.save(update_fields=["npc_standing"])
        self.npc_url = f"/api/npcs/{self.npc.id}/"
        self.faction_url = f"/api/factions/{self.faction.id}/"
        self.char_url = f"/api/characters/{self.pc.id}/"
        self.crew_url = f"/api/crews/{self.crew.id}/"
        self.campaign_url = f"/api/campaigns/{self.campaign.id}/"

    def test_gm_npc_retrieve_keeps_sections(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        r = client.get(self.npc_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["playbook"], "STAND")
        self.assertEqual(r.data["notes"], "boss secret")
        self.assertEqual(r.data["stand_name"], "King Crimson")
        self.assertEqual(r.data["faction"], self.faction.id)
        self.assertEqual(r.data["pc_standing"][str(self.pc.id)], 2)
        self.assertEqual(r.data["abilities"][0]["name"], "Epitaph")

    def test_player_npc_retrieve_redacts_each_section(self):
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.get(self.npc_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["playbook"], "")
        self.assertEqual(r.data["abilities"], [])
        self.assertEqual(r.data["custom_abilities"], "")
        self.assertEqual(r.data["pc_standing"], {})
        self.assertIsNone(r.data["faction"])
        self.assertEqual(r.data["notes"], "")
        self.assertEqual(r.data["stand_name"], "")
        self.assertEqual(r.data["stand_description"], "")
        self.assertEqual(r.data["stand_identity_types"], [])
        self.assertEqual(r.data["stand_forms"], [])
        self.assertEqual(r.data["stand_consciousness"], "")
        self.assertEqual(r.data["contacts"], [])
        self.assertEqual(r.data["crew_standing"], {})

    def test_player_summary_and_character_standing_follow_pc_standing_flag(self):
        client = APIClient()
        client.force_authenticate(self.player)
        camp = client.get(self.campaign_url)
        self.assertEqual(camp.status_code, status.HTTP_200_OK, camp.data)
        row = next(n for n in camp.data["campaign_npcs"] if n["id"] == self.npc.id)
        self.assertEqual(row["playbook"], "")
        self.assertEqual(row["stand_name"], "")
        self.assertEqual(row["pc_standing"], {})
        self.assertEqual(row["crew_standing"], {})
        char = client.get(self.char_url)
        self.assertEqual(char.status_code, status.HTTP_200_OK, char.data)
        self.assertNotIn(str(self.npc.id), char.data.get("npc_standing") or {})

    def test_gm_character_keeps_npc_standing(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        char = client.get(self.char_url)
        self.assertEqual(char.status_code, status.HTTP_200_OK, char.data)
        self.assertEqual(char.data["npc_standing"][str(self.npc.id)], 2)

    def test_membership_off_is_unaffiliated_on_faction_list(self):
        client = APIClient()
        client.force_authenticate(self.player)
        fac = client.get(self.faction_url)
        self.assertEqual(fac.status_code, status.HTTP_200_OK, fac.data)
        self.assertEqual(fac.data.get("npcs") or [], [])
        camp = client.get(self.campaign_url)
        names = {n["name"] for n in camp.data["campaign_npcs"]}
        self.assertIn("Diavolo", names)

    def test_hidden_faction_blanks_identity_inventory_and_contacts(self):
        self.faction.visible_to_players = False
        self.faction.save(update_fields=["visible_to_players"])
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.get(self.faction_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["name"], "")
        self.assertEqual(r.data["faction_type"], "")
        self.assertEqual(r.data["inventory"], [])
        self.assertEqual(r.data["contacts"], [])
        self.assertEqual(r.data["faction_status"], {})
        self.assertEqual(r.data["notes"], "")
        camp = client.get(self.campaign_url)
        names = {n["name"] for n in camp.data["campaign_npcs"]}
        self.assertIn("Diavolo", names)

    def test_players_see_npcs_false_keeps_see_on_npc(self):
        self.npc.players_see = {"faction_membership": True}
        self.npc.save(update_fields=["players_see"])
        self.faction.players_see_npcs = False
        self.faction.save(update_fields=["players_see_npcs"])
        client = APIClient()
        client.force_authenticate(self.player)
        fac = client.get(self.faction_url)
        self.assertEqual(fac.data.get("npcs") or [], [])
        camp = client.get(self.campaign_url)
        names = {n["name"] for n in camp.data["campaign_npcs"]}
        self.assertIn("Diavolo", names)

    def test_hidden_npc_drops_from_faction_member_list(self):
        self.npc.visible_to_players = False
        self.npc.players_see = {}
        self.npc.save(update_fields=["visible_to_players", "players_see"])
        client = APIClient()
        client.force_authenticate(self.player)
        fac = client.get(self.faction_url)
        ids = {n["id"] for n in (fac.data.get("npcs") or [])}
        self.assertNotIn(self.npc.id, ids)
        camp = client.get(self.campaign_url)
        ids = {n["id"] for n in camp.data["campaign_npcs"]}
        self.assertNotIn(self.npc.id, ids)

    def test_crew_standing_shows_while_faction_rep_hint_is_hidden(self):
        self.npc.players_see = {"crew_standing": True, "faction_membership": True}
        self.npc.save(update_fields=["players_see"])
        self.faction.players_see_reputation = False
        self.faction.save(update_fields=["players_see_reputation"])
        client = APIClient()
        client.force_authenticate(self.player)
        npc = client.get(self.npc_url)
        self.assertEqual(npc.data["crew_standing"][str(self.crew.id)], -1)
        crew = client.get(self.crew_url)
        row = next(
            r
            for r in crew.data["faction_relationships"]
            if r["faction_id"] == self.faction.id
        )
        self.assertIsNone(row["reputation_value"])

    def test_player_faction_field_flags(self):
        self.faction.players_see_identity = False
        self.faction.players_see_inventory = False
        self.faction.players_see_contacts = False
        self.faction.players_see_faction_status = False
        self.faction.save(
            update_fields=[
                "players_see_identity",
                "players_see_inventory",
                "players_see_contacts",
                "players_see_faction_status",
            ]
        )
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.get(self.faction_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["name"], "")
        self.assertEqual(r.data["faction_type"], "")
        self.assertEqual(r.data["level"], 4)
        self.assertEqual(r.data["inventory"], [])
        self.assertEqual(r.data["contacts"], [])
        self.assertEqual(r.data["faction_status"], {})
        client.force_authenticate(self.gm)
        gm = client.get(self.faction_url)
        self.assertEqual(gm.data["name"], "Passione")
        self.assertEqual(gm.data["inventory"], [{"name": "Vault"}])
