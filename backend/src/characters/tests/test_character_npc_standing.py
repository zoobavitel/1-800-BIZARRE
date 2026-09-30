"""Character.npc_standing prune / clamp (mirror of NPC.pc_standing)."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from characters.models import Campaign, Character, Heritage, NPC
from characters.serializers import CharacterSerializer
from characters.services.pc_standing import normalize_pc_standing


class NormalizeNpcStandingAliasTest(TestCase):
    def test_valid_ids_kwarg(self):
        out = normalize_pc_standing(
            {"1": 9, "2": -9, "x": 1},
            valid_ids=[1, 2],
        )
        self.assertEqual(out, {"1": 3, "2": -3})


class CharacterNpcStandingSerializerTest(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user("pcnpcgm", "pcnpcgm@test.com", "pw")
        self.campaign = Campaign.objects.create(name="C", gm=self.gm)
        self.other = Campaign.objects.create(name="Other", gm=self.gm)
        self.heritage = Heritage.objects.create(
            name="HumanNpcStanding", base_hp=0, description="test"
        )
        self.npc = NPC.objects.create(
            name="Mole",
            creator=self.gm,
            campaign=self.campaign,
            stand_coin_stats={},
        )
        self.pc = Character.objects.create(
            true_name="Hero",
            user=self.gm,
            campaign=self.campaign,
            heritage=self.heritage,
            npc_standing={str(self.npc.id): 1, "999": 2},
        )
        self.factory = APIRequestFactory()

    def _request(self, user):
        req = self.factory.patch("/")
        req.user = user
        return req

    def test_validate_prunes_stale_npc_standing_keys(self):
        ser = CharacterSerializer(
            self.pc,
            data={"npc_standing": {str(self.npc.id): 2, "999": 1}},
            partial=True,
            context={"request": self._request(self.gm)},
        )
        self.assertTrue(ser.is_valid(), ser.errors)
        self.assertEqual(
            ser.validated_data["npc_standing"],
            {str(self.npc.id): 2},
        )

    def test_campaign_change_prunes_npc_standing(self):
        ser = CharacterSerializer(
            self.pc,
            data={"campaign": self.other.id},
            partial=True,
            context={"request": self._request(self.gm)},
        )
        self.assertTrue(ser.is_valid(), ser.errors)
        self.assertEqual(ser.validated_data.get("npc_standing"), {})

    def test_post_delete_npc_prunes_standing(self):
        npc_id = self.npc.id
        self.npc.delete()
        self.pc.refresh_from_db()
        standing = self.pc.npc_standing or {}
        self.assertNotIn(str(npc_id), standing)
