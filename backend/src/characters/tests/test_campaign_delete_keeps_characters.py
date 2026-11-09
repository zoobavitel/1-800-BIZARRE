"""Deleting a campaign keeps players' PCs, NPCs and the PCs' rolls (Z).

The user's rule (2026-10-29): deleting a campaign must not delete anyone's
player character or NPC, and each PC keeps its past rolls. Before this,
Character.campaign, NPC.campaign and Roll.session were CASCADE, so all of
them went with the campaign.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    NPC, Campaign, Character, CharacterHistory, Crew, Faction, Heritage, Roll, Session,
)


class CampaignDeleteKeepsCharactersTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="cdk_gm", password="pw-cdk-gm-1")
        self.player = User.objects.create_user(username="cdk_player", password="pw-cdk-player-1")
        self.campaign = Campaign.objects.create(name="Doomed Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        crew = Crew.objects.create(name="Doomed Crew", campaign=self.campaign)
        faction = Faction.objects.create(name="Doomed Faction", campaign=self.campaign)
        heritage, _ = Heritage.objects.get_or_create(name="Human", defaults={"base_hp": 0, "description": ""})
        self.pc = Character.objects.create(
            user=self.player, campaign=self.campaign, crew=crew,
            true_name="Survivor PC", heritage=heritage,
        )
        self.npc = NPC.objects.create(
            name="Survivor NPC", creator=self.gm, campaign=self.campaign, faction=faction, crew=crew,
        )
        session = Session.objects.create(campaign=self.campaign, name="Doomed S1")
        self.roll = Roll.objects.create(character=self.pc, session=session)
        self.history = CharacterHistory.objects.create(
            character=self.pc, editor=self.player, changed_fields={"rival": {"old": "", "new": "x"}}
        )

    def delete_campaign(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        response = client.delete(f"/api/campaigns/{self.campaign.id}/")
        self.assertIn(response.status_code, (200, 204), getattr(response, "data", None))

    def test_pcs_survive_with_no_campaign_or_crew(self):
        self.delete_campaign()
        self.assertTrue(Character.objects.filter(pk=self.pc.pk).exists())
        self.pc.refresh_from_db()
        self.assertIsNone(self.pc.campaign_id)
        self.assertIsNone(self.pc.crew_id)
        self.assertTrue(CharacterHistory.objects.filter(pk=self.history.pk).exists())

    def test_npcs_survive_with_no_campaign_faction_or_crew(self):
        self.delete_campaign()
        self.assertTrue(NPC.objects.filter(pk=self.npc.pk).exists())
        self.npc.refresh_from_db()
        self.assertIsNone(self.npc.campaign_id)
        self.assertIsNone(self.npc.faction_id)
        self.assertIsNone(self.npc.crew_id)

    def test_the_pc_keeps_its_rolls_and_its_player_can_still_see_them(self):
        self.delete_campaign()
        self.assertTrue(Roll.objects.filter(pk=self.roll.pk).exists())
        self.roll.refresh_from_db()
        self.assertIsNone(self.roll.session_id)
        client = APIClient()
        client.force_authenticate(self.player)
        response = client.get(f"/api/rolls/?character={self.pc.id}")
        self.assertEqual(response.status_code, 200)
        rows = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        self.assertIn(self.roll.pk, [r["id"] for r in rows])
