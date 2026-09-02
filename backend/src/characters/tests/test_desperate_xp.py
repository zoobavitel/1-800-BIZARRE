"""award_desperate_action_xp: +1 attribute XP, +2 at zero dots; routes through credit_xp."""
from django.contrib.auth.models import User
from django.test import TestCase

from characters.models import (
    Campaign,
    Character,
    Crew,
    ExperienceTracker,
    Heritage,
    PendingAdvance,
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
            "results": [6],
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
        self.assertEqual(et.description, "Desperate roll: hunt")

    def test_zero_dot_grants_two_xp(self):
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
        self.assertIn("0-dot", et.description)

    def test_at_cap_still_credits_and_mints_pending(self):
        """Fill-clear: marks at 5 + 2 → 1 pending + leftover 2."""
        self.character.xp_clocks = {**self.character.xp_clocks, "insight": 5}
        self.character.save(update_fields=["xp_clocks"])
        roll = self._roll(pool_action_rating=0)
        xp, track = award_desperate_action_xp(
            self.character, self.session, roll, "hunt", self.gm
        )
        self.assertEqual(xp, 2)
        self.assertEqual(track, "insight")
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("insight"), 2)
        self.assertEqual(
            PendingAdvance.objects.filter(
                character=self.character, track="insight", status="open"
            ).count(),
            1,
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
