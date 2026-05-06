"""RollSerializer exposes all ExperienceTracker rows on a roll (xp_award_details)."""
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
from characters.serializers import RollSerializer


class RollXpAwardDetailsSerializerTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="gm_rxp", password="pw")
        self.player = User.objects.create_user(username="pl_rxp", password="pw")
        self.campaign = Campaign.objects.create(name="Roll XP Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="Roll XP Crew", campaign=self.campaign)
        self.h, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "t"},
        )
        self.character = Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            crew=self.crew,
            true_name="RX PC",
            heritage=self.h,
            xp_clocks={"insight": 2, "heritage": 1, "playbook": 3},
            action_dots={},
        )
        self.session = Session.objects.create(
            campaign=self.campaign,
            name="R1",
            status="ACTIVE",
        )

    def test_xp_award_details_ordered_lists_all_trackers(self):
        roll = Roll.objects.create(
            character=self.character,
            session=self.session,
            roll_type="ACTION",
            action_name="hunt",
            position="desperate",
            outcome="FULL_SUCCESS",
            description="test",
        )
        ExperienceTracker.objects.create(
            character=self.character,
            session=self.session,
            roll=roll,
            trigger="BELIEFS",
            description="heritage note",
            xp_gained=1,
        )
        ExperienceTracker.objects.create(
            character=self.character,
            session=self.session,
            roll=roll,
            trigger="DESPERATE_ROLL",
            description="desperate",
            xp_gained=1,
        )
        data = RollSerializer(roll).data
        details = data["xp_award_details"]
        self.assertEqual(len(details), 2)
        self.assertEqual(details[0]["trigger"], "BELIEFS")
        self.assertEqual(details[0]["track"], "heritage")
        self.assertEqual(details[1]["trigger"], "DESPERATE_ROLL")
        self.assertEqual(details[1]["track"], "insight")
        self.assertEqual(data["xp_award_detail"]["trigger"], "BELIEFS")
