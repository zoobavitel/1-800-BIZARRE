"""Stash is personal; the crew has coin (user, 2026-11-03; SRD Coin and Stash).

A PC in a crew used to read and write the crew's shared grid
(Crew.stash_slots). Now every PC keeps its own Character.stash_slots, and
the crew's old grid is copied into each member once (migration).
"""

from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase

from characters.models import Campaign, Character, Crew, Heritage
from characters.services.sheet_export.pc_builder import _stash_slots
from characters.services.stash_personal import copy_crew_stash_to_members


def _stash_with_n_filled(n: int) -> list[bool]:
    slots = [False] * 40
    for i in range(min(n, 40)):
        slots[i] = True
    return slots


class PersonalStashTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm_stash", password="pass")
        self.player = User.objects.create_user(username="pc_stash", password="pass")
        self.heritage = Heritage.objects.create(name="Human", base_hp=0, description="Test")
        self.campaign = Campaign.objects.create(name="Stash Camp", gm=self.gm, description="Test")
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
            stash_slots=_stash_with_n_filled(1),
        )

    def _effective(self):
        self.client.force_authenticate(user=self.player)
        r = self.client.get(f"/api/characters/{self.character.id}/")
        self.assertEqual(r.status_code, 200)
        return sum(1 for x in r.data["effective_stash_slots"] if x)

    def test_crewed_pc_reads_its_own_stash(self):
        self.assertEqual(self._effective(), 1)

    def test_crewed_pc_saves_its_own_stash(self):
        self.client.force_authenticate(user=self.player)
        r = self.client.patch(
            f"/api/characters/{self.character.id}/",
            {"stash_slots": _stash_with_n_filled(6)},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(self._effective(), 6)

    def test_crew_stash_patch_no_longer_changes_a_members_stash(self):
        # Old sheets still send it until the frontend change ships.
        self.client.force_authenticate(user=self.player)
        r = self.client.patch(
            f"/api/crews/{self.crew.id}/",
            {"stash_slots": _stash_with_n_filled(9)},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(self._effective(), 1)

    def test_pdf_export_uses_the_personal_stash(self):
        self.assertEqual(sum(_stash_slots(self.character)), 1)


class CopyCrewStashTests(APITestCase):
    """The one-off copy the migration runs."""

    def setUp(self):
        gm = User.objects.create_user(username="cp_gm", password="pass")
        heritage = Heritage.objects.create(name="Human", base_hp=0, description="Test")
        campaign = Campaign.objects.create(name="Copy Camp", gm=gm)
        self.crew = Crew.objects.create(
            name="Copy Crew", campaign=campaign, stash_slots=_stash_with_n_filled(4)
        )
        self.empty_crew = Crew.objects.create(name="Empty Crew", campaign=campaign)

        def pc(name, crew, filled):
            user = User.objects.create_user(username=f"cp_{name}", password="pass")
            return Character.objects.create(
                user=user, true_name=name, heritage=heritage, campaign=campaign,
                crew=crew, stash_slots=_stash_with_n_filled(filled),
            )

        self.empty_member = pc("empty", self.crew, 0)
        self.richer_member = pc("richer", self.crew, 7)
        self.other_crew_member = pc("other", self.empty_crew, 2)
        self.loose = pc("loose", None, 5)

    def _filled(self, character):
        character.refresh_from_db()
        return sum(1 for x in character.stash_slots if x)

    def test_members_get_the_crew_grid_unless_theirs_has_more(self):
        copy_crew_stash_to_members(Crew, Character)
        self.assertEqual(self._filled(self.empty_member), 4)
        self.assertEqual(self._filled(self.richer_member), 7)
        self.assertEqual(self._filled(self.other_crew_member), 2)
        self.assertEqual(self._filled(self.loose), 5)

    def test_running_twice_changes_nothing(self):
        copy_crew_stash_to_members(Crew, Character)
        copy_crew_stash_to_members(Crew, Character)
        self.assertEqual(self._filled(self.empty_member), 4)
