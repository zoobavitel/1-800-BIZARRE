"""NPC.crew FK, crew_standing prune, campaign npc_members visibility."""
from django.contrib.auth.models import User
from django.test import RequestFactory, TestCase
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from characters.models import Campaign, Character, Crew, Faction, Heritage, NPC
from characters.serializers import (
    CharacterSerializer,
    CrewCampaignSerializer,
    NPCSerializer,
)
from characters.services.crew_standing import normalize_crew_standing


class NormalizeCrewStandingTest(TestCase):
    def test_clamps_and_drops_bad_keys(self):
        out = normalize_crew_standing(
            {"1": 9, "2": -9, "x": 1, "3": "nope"},
            valid_crew_ids=[1, 2],
        )
        self.assertEqual(out, {"1": 3, "2": -3})

    def test_empty_on_non_dict(self):
        self.assertEqual(normalize_crew_standing([1, 2]), {})


class NPCCrewStandingSerializerTest(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user("npcgm", "npcgm@test.com", "pw")
        self.campaign = Campaign.objects.create(name="C", gm=self.gm)
        self.other = Campaign.objects.create(name="Other", gm=self.gm)
        self.crew = Crew.objects.create(name="PCs", campaign=self.campaign)
        self.crew_b = Crew.objects.create(name="OtherCrew", campaign=self.other)
        self.faction = Faction.objects.create(name="F", campaign=self.campaign)
        self.npc = NPC.objects.create(
            name="Mole",
            creator=self.gm,
            campaign=self.campaign,
            faction=self.faction,
            crew=self.crew,
            crew_standing={str(self.crew.id): 2, "999": 1},
            stand_coin_stats={},
        )
        self.factory = APIRequestFactory()

    def _request(self, user):
        req = self.factory.patch("/")
        req.user = user
        return req

    def test_faction_and_crew_coexist(self):
        self.assertEqual(self.npc.faction_id, self.faction.id)
        self.assertEqual(self.npc.crew_id, self.crew.id)

    def test_validate_prunes_stale_standing_keys(self):
        ser = NPCSerializer(
            self.npc,
            data={"crew_standing": {str(self.crew.id): 2, "999": 1}},
            partial=True,
            context={"request": self._request(self.gm)},
        )
        self.assertTrue(ser.is_valid(), ser.errors)
        self.assertEqual(
            ser.validated_data["crew_standing"],
            {str(self.crew.id): 2},
        )

    def test_crew_must_match_campaign(self):
        ser = NPCSerializer(
            self.npc,
            data={"crew": self.crew_b.id},
            partial=True,
            context={"request": self._request(self.gm)},
        )
        self.assertFalse(ser.is_valid())
        self.assertIn("crew", ser.errors)

    def test_campaign_change_clears_mismatched_crew(self):
        ser = NPCSerializer(
            self.npc,
            data={"campaign": self.other.id},
            partial=True,
            context={"request": self._request(self.gm)},
        )
        self.assertTrue(ser.is_valid(), ser.errors)
        self.assertIsNone(ser.validated_data.get("crew"))

    def test_post_delete_crew_prunes_standing(self):
        crew_id = self.crew.id
        self.crew.delete()
        self.npc.refresh_from_db()
        self.assertIsNone(self.npc.crew_id)
        standing = self.npc.crew_standing or {}
        self.assertNotIn(str(crew_id), standing)


