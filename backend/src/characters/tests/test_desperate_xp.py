"""award_desperate_action_xp: +1 default, +2 for 0-dot per SRD lines 1356–1358.

SRD `docs/1-(800)-BIZARRE SRD.md`:
  - 1342: desperate skill check → +1 XP on the relevant attribute.
  - 1356–1358: rolling with **zero dots** at desperate position → +2 XP.

Each attribute track caps at 5; 0-dot bonus is clipped when near the cap.
"""
from django.contrib.auth.models import User
from django.test import TestCase

from characters.models import (
    Campaign,
    Character,
    Crew,
    ExperienceTracker,
    Heritage,
    Roll,
    Session,
)
from characters.roll_helpers import award_desperate_action_xp


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


class DesperateActionXpTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="gm_dxp", password="pw")
        self.player = User.objects.create_user(username="pl_dxp", password="pw")
        self.campaign = Campaign.objects.create(name="DXP Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="DXP Crew", campaign=self.campaign)
        self.heritage, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "t"},
        )
        self.character = Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            crew=self.crew,
            true_name="DXP PC",
            heritage=self.heritage,
            action_dots=_zero_action_dots(),
            xp_clocks={"insight": 0, "prowess": 0, "resolve": 0, "playbook": 0},
        )
        self.session = Session.objects.create(
            campaign=self.campaign,
            name="DS1",
            status="ACTIVE",
        )

    def _roll(self, **kwargs):
        defaults = {
            "character": self.character,
            "session": self.session,
            "roll_type": "ACTION",
            "outcome": "FULL_SUCCESS",
            "position": "desperate",
            "action_name": "hunt",
            "pool_action_rating": 1,
        }
        defaults.update(kwargs)
        return Roll.objects.create(**defaults)

    def test_default_grant_is_one_xp_when_dots_present(self):
        roll = self._roll(pool_action_rating=2)
        xp, track = award_desperate_action_xp(
            self.character, self.session, roll, "hunt", self.gm
        )
        self.assertEqual(xp, 1)
        self.assertEqual(track, "insight")
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("insight"), 1)
        et = ExperienceTracker.objects.get(roll=roll, trigger="DESPERATE_ROLL")
        self.assertEqual(et.xp_gained, 1)
        self.assertNotIn("0-dot", et.description)

    def test_zero_dot_bonus_grants_two_xp(self):
        roll = self._roll(pool_action_rating=0)
        xp, track = award_desperate_action_xp(
            self.character, self.session, roll, "hunt", self.gm
        )
        self.assertEqual(xp, 2)
        self.assertEqual(track, "insight")
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("insight"), 2)
        et = ExperienceTracker.objects.get(roll=roll, trigger="DESPERATE_ROLL")
        self.assertEqual(et.xp_gained, 2)
        self.assertIn("0-dot bonus", et.description)

    def test_zero_dot_bonus_clipped_to_one_when_track_at_four(self):
        self.character.xp_clocks = {**self.character.xp_clocks, "insight": 4}
        self.character.save(update_fields=["xp_clocks"])
        roll = self._roll(pool_action_rating=0)
        xp, _ = award_desperate_action_xp(
            self.character, self.session, roll, "hunt", self.gm
        )
        self.assertEqual(xp, 1)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("insight"), 5)
        et = ExperienceTracker.objects.get(roll=roll, trigger="DESPERATE_ROLL")
        self.assertEqual(et.xp_gained, 1)
        self.assertIn("clipped by cap", et.description)

    def test_track_already_at_cap_no_grant(self):
        self.character.xp_clocks = {**self.character.xp_clocks, "insight": 5}
        self.character.save(update_fields=["xp_clocks"])
        roll = self._roll(pool_action_rating=0)
        xp, track = award_desperate_action_xp(
            self.character, self.session, roll, "hunt", self.gm
        )
        self.assertEqual(xp, 0)
        self.assertIsNone(track)
        self.assertFalse(
            ExperienceTracker.objects.filter(roll=roll, trigger="DESPERATE_ROLL").exists()
        )

    def test_non_desperate_position_no_grant(self):
        roll = self._roll(position="risky", pool_action_rating=0)
        xp, track = award_desperate_action_xp(
            self.character, self.session, roll, "hunt", self.gm
        )
        self.assertEqual(xp, 0)
        self.assertIsNone(track)

    def test_non_action_roll_no_grant(self):
        roll = self._roll(roll_type="RESISTANCE", pool_action_rating=0)
        xp, track = award_desperate_action_xp(
            self.character, self.session, roll, "hunt", self.gm
        )
        self.assertEqual(xp, 0)
        self.assertIsNone(track)

    def test_unmappable_action_no_grant(self):
        roll = self._roll(action_name="not-an-action", pool_action_rating=0)
        xp, track = award_desperate_action_xp(
            self.character, self.session, roll, "not-an-action", self.gm
        )
        self.assertEqual(xp, 0)
        self.assertIsNone(track)
