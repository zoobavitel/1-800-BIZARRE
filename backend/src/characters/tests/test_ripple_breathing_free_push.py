"""Ripple Breathing: once/session waive push stress on action rolls."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    CharacterHamonAbility,
    Crew,
    HamonAbility,
    Heritage,
    Session,
)


class RippleBreathingFreePushTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="rb", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.campaign = Campaign.objects.create(
            name="C",
            gm=self.user,
        )
        self.crew = Crew.objects.create(name="Team", campaign=self.campaign)
        self.human, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "test"},
        )
        dots = {
            "hunt": 2,
            "study": 0,
            "survey": 0,
            "tinker": 1,
            "finesse": 0,
            "prowl": 0,
            "skirmish": 0,
            "wreck": 0,
            "bizarre": 0,
            "command": 0,
            "consort": 0,
            "sway": 0,
        }
        self.actor = Character.objects.create(
            true_name="Hamon PC",
            name="Hamon PC",
            user=self.user,
            campaign=self.campaign,
            crew=self.crew,
            heritage=self.human,
            action_dots=dots,
            stress=0,
        )

        ripple = HamonAbility.objects.filter(name__iexact="Ripple Breathing").first()
        if not ripple:
            ripple = HamonAbility.objects.create(
                name="Ripple Breathing",
                hamon_type="FOUNDATION",
                description=(
                    "+1d to resist poison, fatigue, or fear. Once per score, "
                    "push yourself with no stress cost."
                ),
                required_a_count=0,
                stress_cost=0,
                frequency="Once per score",
            )
        CharacterHamonAbility.objects.get_or_create(
            character=self.actor, hamon_ability=ripple
        )

        self.session = Session.objects.create(
            campaign=self.campaign,
            name="S1",
            status="ACTIVE",
        )

        self.roll_url = f"/api/characters/{self.actor.id}/roll-action/"

    def test_free_push_waives_stress_and_marks_session(self):
        r = self.client.post(
            self.roll_url,
            {
                "action": "hunt",
                "session_id": self.session.id,
                "push_effect": True,
                "ripple_breathing_free_push": True,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.actor.refresh_from_db()
        self.session.refresh_from_db()
        claimed = getattr(
            self.session, "ripple_breathing_free_push_claimed_by_character", {}
        )
        self.assertTrue(claimed.get(str(self.actor.id)))
        push_stress = next(
            (x for x in r.data.get("stress_sources") or [] if x.get("kind") == "push"),
            None,
        )
        waive = next(
            (
                x
                for x in r.data.get("stress_sources") or []
                if "Ripple Breathing" in str(x.get("name", ""))
            ),
            None,
        )
        self.assertTrue(push_stress)
        self.assertTrue(waive)

    def test_rejects_second_use_same_session(self):
        self.session.ripple_breathing_free_push_claimed_by_character = {
            str(self.actor.id): True
        }
        self.session.save(update_fields=["ripple_breathing_free_push_claimed_by_character"])

        r = self.client.post(
            self.roll_url,
            {
                "action": "hunt",
                "session_id": self.session.id,
                "push_dice": True,
                "ripple_breathing_free_push": True,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertIn("already used", str(r.data.get("error", "")).lower())
