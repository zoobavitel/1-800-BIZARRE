"""Crew stash grid: member access and effective_stash_slots on character GET."""

from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase

from characters.models import Campaign, Character, Crew, Heritage


def _stash_with_n_filled(n: int) -> list[bool]:
    slots = [False] * 40
    for i in range(min(n, 40)):
        slots[i] = True
    return slots


class CrewStashGridTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm_stash", password="pass")
        self.player = User.objects.create_user(username="pc_stash", password="pass")
        self.heritage = Heritage.objects.create(
            name="Human", base_hp=0, description="Test"
        )
        self.campaign = Campaign.objects.create(
            name="Stash Camp", gm=self.gm, description="Test"
        )
        self.campaign.players.add(self.player)
        self.crew = Crew.objects.create(
            name="Bubble Guppies",
            campaign=self.campaign,
            stash_slots=_stash_with_n_filled(3),
        )
        self.character = Character.objects.create(
            user=self.player,
            true_name="Ojon Gae",
            heritage=self.heritage,
            campaign=self.campaign,
            crew=self.crew,
        )

    def test_character_get_exposes_effective_stash_from_crew(self):
        self.client.force_authenticate(user=self.player)
        r = self.client.get(f"/api/characters/{self.character.id}/")
        self.assertEqual(r.status_code, 200)
        effective = r.data.get("effective_stash_slots")
        self.assertIsInstance(effective, list)
        self.assertEqual(len(effective), 40)
        self.assertEqual(sum(1 for x in effective if x), 3)

    def test_crew_member_can_patch_stash_slots(self):
        self.client.force_authenticate(user=self.player)
        slots = _stash_with_n_filled(5)
        r = self.client.patch(
            f"/api/crews/{self.crew.id}/",
            {"stash_slots": slots},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.crew.refresh_from_db()
        self.assertEqual(list(self.crew.stash_slots), slots)

    def test_effective_stash_updates_after_crew_patch(self):
        self.client.force_authenticate(user=self.player)
        slots = _stash_with_n_filled(7)
        self.client.patch(
            f"/api/crews/{self.crew.id}/",
            {"stash_slots": slots},
            format="json",
        )
        r = self.client.get(f"/api/characters/{self.character.id}/")
        self.assertEqual(sum(1 for x in r.data["effective_stash_slots"] if x), 7)
