"""Resistance roll stress must survive concurrent sheet PATCH that omits stress."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Crew, Heritage, Session


class ResistanceStressPatchRaceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="resist_race", password="pass")
        self.gm = User.objects.create_user(username="gm_resist_race", password="pass")
        self.campaign = Campaign.objects.create(name="Resist Race Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="Resist Race Crew", campaign=self.campaign)
        self.h, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "test"},
        )
        self.actor = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Resist Race PC",
            heritage=self.h,
            action_dots={
                "hunt": 1,
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
            },
            stress=2,
            trauma=[],
            xp_clocks={},
        )
        self.session = Session.objects.create(
            campaign=self.campaign, name="Resist Race S1", status="ACTIVE"
        )

    def test_resistance_stress_survives_concurrent_patch_omitting_stress(self):
        self.client.force_authenticate(user=self.user)
        create = self.client.post(
            "/api/rolls/",
            {
                "character": self.actor.id,
                "session": self.session.id,
                "roll_type": "RESISTANCE",
                "action_name": "prowess",
                "dice_pool": 2,
                "results": [3, 4],
                "outcome": "PARTIAL_SUCCESS",
                "description": "Resistance prowess roll",
                "roller_stress_spent": 3,
            },
            format="json",
        )
        self.assertEqual(create.status_code, status.HTTP_201_CREATED, create.data)
        self.actor.refresh_from_db()
        self.assertEqual(self.actor.stress, 5)

        # Concurrent sheet autosave PATCH that omits stress (inventory-only style).
        patch = self.client.patch(
            f"/api/characters/{self.actor.id}/",
            {
                "background_note2": "inventory race note",
                "inventory": [{"name": "Knife", "load": 1}],
            },
            format="json",
        )
        self.assertEqual(patch.status_code, status.HTTP_200_OK, patch.data)
        self.actor.refresh_from_db()
        self.assertEqual(
            self.actor.stress,
            5,
            "Server-applied resistance stress must survive PATCH that omits stress",
        )

    def test_resistance_create_accepts_stand_durability_action_name(self):
        self.client.force_authenticate(user=self.user)
        create = self.client.post(
            "/api/rolls/",
            {
                "character": self.actor.id,
                "session": self.session.id,
                "roll_type": "RESISTANCE",
                "action_name": "stand_durability",
                "dice_pool": 2,
                "results": [4, 5],
                "outcome": "PARTIAL_SUCCESS",
                "description": "Manual resistance record Durability",
                "roller_stress_spent": 1,
            },
            format="json",
        )
        self.assertEqual(create.status_code, status.HTTP_201_CREATED, create.data)
        self.assertEqual(create.data.get("action_name"), "stand_durability")
        self.assertEqual(create.data.get("roll_type"), "RESISTANCE")
