"""SRD: action roll pool = action rating only; attribute rating is resistance-only."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Crew, Heritage, Session
from characters.views import CharacterViewSet


class ActionPoolNoAttributeDiceTests(TestCase):
    """Skirmish 3 / Prowl 2 / Wreck 1 → Prowess attr 3, but action pools stay 3/2/1."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="attrpool_u", password="pass")
        self.gm = User.objects.create_user(username="attrpool_gm", password="pass")
        self.campaign = Campaign.objects.create(name="AttrPool Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="AttrPool Crew", campaign=self.campaign)
        self.h, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "test"},
        )
        self.char = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Attr Pool PC",
            heritage=self.h,
            action_dots={
                "hunt": 0,
                "study": 0,
                "survey": 0,
                "tinker": 0,
                "finesse": 0,
                "prowl": 2,
                "skirmish": 3,
                "wreck": 1,
                "bizarre": 0,
                "command": 0,
                "consort": 0,
                "sway": 0,
            },
            stress=0,
        )
        self.session = Session.objects.create(
            campaign=self.campaign, name="AttrPool S1"
        )
        self.session.characters_involved.add(self.char)
        self.client.force_authenticate(user=self.user)

    def _roll(self, action):
        return self.client.post(
            f"/api/characters/{self.char.id}/roll-action/",
            {
                "action": action,
                "roll_type": "ACTION",
                "position": "risky",
                "effect": "standard",
                "session_id": self.session.id,
            },
            format="json",
        )

    def test_live_viewset_is_character_views_package(self):
        self.assertEqual(
            CharacterViewSet.__module__, "characters.views.character_views"
        )

    def test_action_pools_exclude_attribute_rating(self):
        expected = {"skirmish": 3, "prowl": 2, "wreck": 1}
        for action, pool in expected.items():
            r = self._roll(action)
            self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
            self.assertEqual(r.data["attribute_dice"], 0)
            self.assertEqual(r.data["rating"], pool)
            self.assertEqual(r.data["total_dice"], pool)
            # Bug signature of removed legacy views.py: total = action + prowess breadth
            self.assertNotEqual(r.data["total_dice"], pool + 3)
