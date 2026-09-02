"""Innate stand-dice XP: desperate Power/Speed/Precision → +1 playbook, uncapped."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    Crew,
    ExperienceTracker,
    Heritage,
    Roll,
    Session,
    Stand,
)
from characters.roll_helpers import (
    award_desperate_action_xp,
    award_innate_stand_dice_xp,
    innate_stand_stat_from_roll,
)
from characters.services.xp_allocation import apply_level_up, undo_allocation


def _zero_action_dots():
    return {
        "hunt": 0,
        "study": 0,
        "survey": 0,
        "tinker": 0,
        "finesse": 0,
        "prowl": 0,
        "skirmish": 0,
        "wreck": 0,
        "bizarre": 0,
        "command": 0,
        "consort": 0,
        "sway": 0,
    }


class InnateStandDiceXpTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="gm_innate", password="pw")
        self.player = User.objects.create_user(username="pl_innate", password="pw")
        self.campaign = Campaign.objects.create(name="Innate Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="Innate Crew", campaign=self.campaign)
        self.heritage, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "t"},
        )
        self.character = Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Innate PC",
            heritage=self.heritage,
            action_dots=_zero_action_dots(),
            xp_clocks={"insight": 0, "prowess": 0, "resolve": 0, "playbook": 0},
            coin_stats={
                "power": "A",
                "speed": "C",
                "range": "D",
                "durability": "B",
                "precision": "D",
                "development": "D",
            },
        )
        Stand.objects.create(
            character=self.character,
            name="Innate Stand",
            type="FIGHTING",
            form="Humanoid",
            consciousness_level="C",
            power="A",
            speed="C",
            range="D",
            durability="B",
            precision="D",
            development="D",
        )
        self.session = Session.objects.create(
            campaign=self.campaign,
            name="IS1",
            status="ACTIVE",
        )
        self.client = APIClient()

    def _roll(self, **kwargs):
        defaults = {
            "character": self.character,
            "session": self.session,
            "roll_type": "ACTION",
            "outcome": "FULL_SUCCESS",
            "position": "desperate",
            "action_name": "stand_speed",
            "pool_action_rating": 2,
        }
        defaults.update(kwargs)
        return Roll.objects.create(**defaults)

    def test_innate_stat_resolver(self):
        self.assertEqual(innate_stand_stat_from_roll("stand_speed"), "speed")
        self.assertEqual(innate_stand_stat_from_roll("power"), "power")
        self.assertEqual(
            innate_stand_stat_from_roll("hunt", stand_stat="precision"), "precision"
        )
        self.assertIsNone(innate_stand_stat_from_roll("stand_durability"))
        self.assertIsNone(innate_stand_stat_from_roll("stand_range"))
        self.assertIsNone(innate_stand_stat_from_roll("hunt"))

    def test_desperate_speed_grants_playbook(self):
        roll = self._roll(action_name="stand_speed")
        xp, track = award_innate_stand_dice_xp(
            self.character, self.session, roll, "stand_speed", self.gm
        )
        self.assertEqual(xp, 1)
        self.assertEqual(track, "playbook")
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 1)
        et = ExperienceTracker.objects.get(roll=roll, trigger="INNATE")
        self.assertEqual(et.xp_gained, 1)
        self.assertEqual(et.clock_key, "playbook")

    def test_power_and_precision_grant(self):
        for slug in ("stand_power", "stand_precision"):
            roll = self._roll(action_name=slug)
            xp, track = award_innate_stand_dice_xp(
                self.character, self.session, roll, slug, self.gm
            )
            self.assertEqual(xp, 1)
            self.assertEqual(track, "playbook")

    def test_playbook_at_ten_fill_clear_leaves_one(self):
        self.character.xp_clocks = {**self.character.xp_clocks, "playbook": 10}
        self.character.save(update_fields=["xp_clocks"])
        roll = self._roll()
        xp, track = award_innate_stand_dice_xp(
            self.character, self.session, roll, "stand_speed", self.gm
        )
        self.assertEqual(xp, 1)
        self.assertEqual(track, "playbook")
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 1)
        from characters.models import PendingAdvance

        self.assertEqual(
            PendingAdvance.objects.filter(
                character=self.character, track="playbook", status="open"
            ).count(),
            1,
        )

    def test_durability_no_grant(self):
        roll = self._roll(action_name="stand_durability")
        xp, track = award_innate_stand_dice_xp(
            self.character,
            self.session,
            roll,
            "stand_durability",
            self.gm,
            stand_stat="durability",
        )
        self.assertEqual(xp, 0)
        self.assertIsNone(track)
        self.assertFalse(
            ExperienceTracker.objects.filter(roll=roll, trigger="INNATE").exists()
        )

    def test_risky_and_user_action_no_innate(self):
        risky = self._roll(position="risky")
        xp, track = award_innate_stand_dice_xp(
            self.character, self.session, risky, "stand_speed", self.gm
        )
        self.assertEqual(xp, 0)
        hunt = self._roll(action_name="hunt")
        xp, track = award_innate_stand_dice_xp(
            self.character, self.session, hunt, "hunt", self.gm
        )
        self.assertEqual(xp, 0)
        dxp, dtrack = award_desperate_action_xp(
            self.character, self.session, hunt, "hunt", self.gm
        )
        self.assertEqual(dxp, 1)
        self.assertEqual(dtrack, "insight")
        self.assertFalse(
            ExperienceTracker.objects.filter(roll=hunt, trigger="INNATE").exists()
        )

    def test_second_award_same_roll_noop(self):
        roll = self._roll()
        award_innate_stand_dice_xp(
            self.character, self.session, roll, "stand_speed", self.gm
        )
        xp, track = award_innate_stand_dice_xp(
            self.character, self.session, roll, "stand_speed", self.gm
        )
        self.assertEqual(xp, 0)
        self.assertIsNone(track)
        self.assertEqual(
            ExperienceTracker.objects.filter(roll=roll, trigger="INNATE").count(), 1
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 1)

    def test_level_up_from_fourteen_leaves_four_undo_restores(self):
        self.character.xp_clocks = {**self.character.xp_clocks, "playbook": 14}
        self.character.save(update_fields=["xp_clocks"])
        alloc = apply_level_up(
            self.character,
            xp_track="playbook",
            choice="stat",
            stand_stat="speed",
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 4)
        undo_allocation(self.character, alloc, user=self.player)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 14)

    def test_roll_action_desperate_speed_awards_playbook(self):
        self.session.default_position = "desperate"
        self.session.save(update_fields=["default_position"])
        self.client.force_authenticate(user=self.player)
        url = f"/api/characters/{self.character.id}/roll-action/"
        r = self.client.post(
            url,
            {
                "action": "stand_speed",
                "session_id": self.session.id,
                "pool_source": "stand_coin",
                "stand_stat": "speed",
                "position": "desperate",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("xp_gained"), 1)
        self.assertEqual(r.data.get("xp_track"), "playbook")
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 1)
        roll = Roll.objects.get(pk=r.data["roll_id"])
        self.assertTrue(
            ExperienceTracker.objects.filter(roll=roll, trigger="INNATE").exists()
        )

    def test_roll_action_durability_desperate_no_innate(self):
        self.session.default_position = "desperate"
        self.session.save(update_fields=["default_position"])
        self.client.force_authenticate(user=self.player)
        url = f"/api/characters/{self.character.id}/roll-action/"
        r = self.client.post(
            url,
            {
                "action": "stand_durability",
                "session_id": self.session.id,
                "pool_source": "stand_coin",
                "stand_stat": "durability",
                "position": "desperate",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertIn("Durability", str(r.data))
        self.assertFalse(
            ExperienceTracker.objects.filter(
                character=self.character, trigger="INNATE"
            ).exists()
        )

    def test_grant_xp_innate_for_stand_dice(self):
        roll = self._roll(action_name="stand_power")
        self.client.force_authenticate(user=self.gm)
        url = f"/api/rolls/{roll.id}/grant-xp/"
        r = self.client.post(url, {}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("track"), "playbook")
        self.assertEqual(r.data.get("amount"), 1)
        r2 = self.client.post(url, {}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)
