"""POST /characters/{id}/reset-sheet/ — blank mechanics, keep identity + heritage."""

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

from characters.models import (
    Ability,
    Benefit,
    Campaign,
    Character,
    CharacterHistory,
    CharacterXPAllocation,
    Crew,
    Detriment,
    ExperienceTracker,
    Heritage,
    Roll,
    Session,
    Stand,
    Vice,
)
from characters.services.character_sheet_reset import reset_character_sheet


class CharacterSheetResetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="reset_gm", password="pw")
        self.owner = User.objects.create_user(username="reset_owner", password="pw")
        self.other = User.objects.create_user(username="reset_other", password="pw")
        self.campaign = Campaign.objects.create(name="Reset Camp", gm=self.gm)
        self.campaign.players.add(self.owner)
        self.heritage = Heritage.objects.create(
            name="Human", base_hp=0, description="Keep me"
        )
        self.ben_req = Benefit.objects.create(
            heritage=self.heritage,
            name="Required Benefit",
            hp_cost=0,
            required=True,
            description="stays",
        )
        self.ben_opt = Benefit.objects.create(
            heritage=self.heritage,
            name="Optional Benefit",
            hp_cost=1,
            required=False,
            description="cleared",
        )
        self.det_req = Detriment.objects.create(
            heritage=self.heritage,
            name="Required Detriment",
            hp_value=0,
            required=True,
            description="stays",
        )
        self.det_opt = Detriment.objects.create(
            heritage=self.heritage,
            name="Optional Detriment",
            hp_value=1,
            required=False,
            description="cleared",
        )
        self.vice, _ = Vice.objects.get_or_create(
            name="Gambling", defaults={"description": "Keep vice"}
        )
        self.crew = Crew.objects.create(name="Keep Crew", campaign=self.campaign)
        self.ability = Ability.objects.create(
            name="Std Extra", type="standard", description="gone"
        )
        self.character = Character.objects.create(
            user=self.owner,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Keep Name",
            alias="Keep Alias",
            appearance="Keep look/style",
            stand_name="Keep Stand Name",
            heritage=self.heritage,
            vice=self.vice,
            vice_details="casino nights",
            personal_crew_name="",
            playbook="HAMON",
            secondary_playbook="SPIN",
            playbook_xp_archetypes=["CAESAR_STYLE"],
            action_dots={"hunt": 2, "study": 1, "skirmish": 2, "sway": 2},
            stress=7,
            trauma=[1, 2],
            xp_clocks={
                "insight": 4,
                "prowess": 3,
                "resolve": 2,
                "heritage": 8,
                "playbook": 10,
            },
            unallocated_xp=5,
            total_xp_spent=95,
            level=10,
            heritage_points_gained=3,
            stand_coin_points_gained=2,
            action_dice_gained=4,
            bonus_hp_from_xp=1,
            coin_stats={
                "power": "A",
                "speed": "B",
                "range": "C",
                "durability": "A",
                "precision": "D",
                "development": "B",
            },
            advancement_ability_grants=[{"name": "XP heritage ability"}],
            inventory=[{"name": "sword"}],
        )
        self.character.selected_benefits.set([self.ben_req, self.ben_opt])
        self.character.selected_detriments.set([self.det_req, self.det_opt])
        self.character.standard_abilities.add(self.ability)
        Stand.objects.create(
            character=self.character,
            name="Keep Stand Name",
            type="COLONY",
            form="Phenomenon",
            consciousness_level="A",
            power="A",
            speed="B",
            range="C",
            durability="A",
            precision="D",
            development="B",
        )
        CharacterXPAllocation.objects.create(
            character=self.character,
            allocation_type="LEVEL_UP_HERITAGE",
            xp_track="heritage",
            xp_cost=10,
            payload_before={},
            payload_after={},
        )
        self.session = Session.objects.create(
            campaign=self.campaign, name="S1", status="ACTIVE"
        )
        self.roll = Roll.objects.create(
            character=self.character,
            session=self.session,
            roll_type="ACTION",
            action_name="hunt",
            outcome="FULL_SUCCESS",
            description="keep session roll",
        )
        ExperienceTracker.objects.create(
            character=self.character,
            session=self.session,
            roll=self.roll,
            trigger="DESPERATE_ROLL",
            description="desperate hunt",
            xp_gained=1,
            clock_key="insight",
        )
        CharacterHistory.objects.create(
            character=self.character,
            editor=self.owner,
            changed_fields={"stress": {"old": "0", "new": "7"}},
        )

    def test_service_keeps_identity_and_required_heritage(self):
        reset_character_sheet(self.character)
        self.character.refresh_from_db()

        self.assertEqual(self.character.campaign_id, self.campaign.id)
        self.assertEqual(self.character.user_id, self.owner.id)
        self.assertEqual(self.character.true_name, "Keep Name")
        self.assertEqual(self.character.alias, "Keep Alias")
        self.assertEqual(self.character.crew_id, self.crew.id)
        self.assertEqual(self.character.appearance, "Keep look/style")
        self.assertEqual(self.character.vice_id, self.vice.id)
        self.assertEqual(self.character.vice_details, "casino nights")
        self.assertEqual(self.character.stand_name, "Keep Stand Name")
        self.assertEqual(self.character.heritage_id, self.heritage.id)

        self.assertEqual(
            set(self.character.selected_benefits.values_list("id", flat=True)),
            {self.ben_req.id},
        )
        self.assertEqual(
            set(self.character.selected_detriments.values_list("id", flat=True)),
            {self.det_req.id},
        )
        self.assertEqual(self.character.heritage_points_gained, 0)
        self.assertEqual(self.character.xp_clocks.get("heritage"), 0)

    def test_service_resets_mechanics_and_clears_xp_logs(self):
        reset_character_sheet(self.character)
        self.character.refresh_from_db()

        self.assertEqual(self.character.playbook, "STAND")
        self.assertIsNone(self.character.secondary_playbook)
        self.assertEqual(self.character.playbook_xp_archetypes, [])
        self.assertEqual(self.character.stress, 0)
        self.assertEqual(self.character.trauma, [])
        self.assertEqual(self.character.action_dots, {})
        self.assertEqual(self.character.unallocated_xp, 0)
        self.assertEqual(self.character.total_xp_spent, 0)
        self.assertEqual(self.character.level, 1)
        self.assertEqual(self.character.xp_clocks.get("insight"), 0)
        self.assertEqual(self.character.xp_clocks.get("playbook"), 0)
        self.assertEqual(self.character.stand_coin_points_gained, 0)
        self.assertEqual(self.character.action_dice_gained, 0)
        self.assertEqual(self.character.bonus_hp_from_xp, 0)
        self.assertEqual(self.character.advancement_ability_grants, [])
        self.assertEqual(self.character.inventory, [])
        self.assertEqual(self.character.standard_abilities.count(), 0)
        self.assertFalse(
            CharacterXPAllocation.objects.filter(character=self.character).exists()
        )
        self.assertFalse(
            ExperienceTracker.objects.filter(character=self.character).exists()
        )
        self.assertFalse(
            CharacterHistory.objects.filter(character=self.character).exists()
        )
        self.assertTrue(Roll.objects.filter(pk=self.roll.pk).exists())

        stand = Stand.objects.get(character=self.character)
        self.assertEqual(stand.name, "Keep Stand Name")
        self.assertEqual(stand.power, "D")
        self.assertEqual(stand.type, "FIGHTING")
        self.assertEqual(self.character.coin_stats.get("power"), "D")

    def test_owner_api_reset_sheet(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(f"/api/characters/{self.character.id}/reset-sheet/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertTrue(res.data.get("success"))
        body = res.data["character"]
        self.assertEqual(body["true_name"], "Keep Name")
        self.assertEqual(body["heritage"], self.heritage.id)
        self.assertEqual(body["campaign"], self.campaign.id)
        self.assertEqual(body["playbook"], "STAND")
        self.assertEqual(body["stress"], 0)
        self.assertEqual(body["total_xp_spent"], 0)
        self.assertEqual(body["heritage_points_gained"], 0)
        self.assertEqual(set(body["selected_benefits"]), {self.ben_req.id})
        self.assertEqual(set(body["selected_detriments"]), {self.det_req.id})
        self.assertEqual(res.data["allocations"], [])
        self.character.refresh_from_db()
        self.assertEqual(self.character.heritage_id, self.heritage.id)

    def test_gm_can_reset_player_sheet(self):
        self.client.force_authenticate(user=self.gm)
        res = self.client.post(f"/api/characters/{self.character.id}/reset-sheet/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.character.refresh_from_db()
        self.assertEqual(self.character.stress, 0)
        self.assertEqual(self.character.heritage_id, self.heritage.id)

    def test_other_user_cannot_reset(self):
        self.client.force_authenticate(user=self.other)
        res = self.client.post(f"/api/characters/{self.character.id}/reset-sheet/")
        self.assertIn(
            res.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.stress, 7)
        self.assertEqual(self.character.heritage_points_gained, 3)
