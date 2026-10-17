from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    Crew,
    ExperienceTracker,
    Heritage,
    Roll,
    Session,
)


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


class SessionRetrieveQueryTests(TestCase):
    """Session GET must not query ExperienceTracker once per roll."""

    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm_sq", password="pw")
        self.player = User.objects.create_user(username="pl_sq", password="pw")
        self.campaign = Campaign.objects.create(name="Query Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="Query Crew", campaign=self.campaign)
        self.heritage, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "t"},
        )
        self.character = Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Query PC",
            heritage=self.heritage,
            action_dots=_zero_action_dots(),
            xp_clocks={"insight": 0, "prowess": 0, "resolve": 0, "playbook": 0},
        )
        self.session = Session.objects.create(
            campaign=self.campaign, name="Q1", status="ACTIVE"
        )
        self.client.force_authenticate(user=self.gm)

    def _add_rolls(self, count):
        for i in range(count):
            roll = Roll.objects.create(
                character=self.character,
                session=self.session,
                roll_type="ACTION",
                outcome="FULL_SUCCESS",
                position="risky",
                action_name="hunt",
                pool_action_rating=1,
                results=[6],
            )
            ExperienceTracker.objects.create(
                character=self.character,
                session=self.session,
                roll=roll,
                trigger="DESPERATE_ROLL",
                description=f"Desperate roll {i}",
                xp_gained=1,
            )

    def _retrieve(self):
        return self.client.get(f"/api/sessions/{self.session.id}/")

    def test_query_count_stays_flat_as_rolls_grow(self):
        self._add_rolls(4)
        with CaptureQueriesContext(connection) as small:
            first = self._retrieve()
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(len(first.data["rolls"]), 4)
        baseline = len(small.captured_queries)
        self.assertLessEqual(baseline, 20)

        self._add_rolls(50)
        with self.assertNumQueries(baseline):
            second = self._retrieve()
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(len(second.data["rolls"]), 54)
        self.assertTrue(any(roll["xp_awarded"] for roll in second.data["rolls"]))
