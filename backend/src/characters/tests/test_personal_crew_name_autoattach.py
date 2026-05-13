"""Tests for the PC-driven crew bootstrap path.

Sheet has a free-text "crew" field (`Character.personal_crew_name`). When a
player saves their sheet while in a campaign, that text should realize the
party crew: create one if none exists, or auto-join the existing campaign
crew. After attach the text is cleared and the player can edit the shared
crew sheet via `CrewViewSet`.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from characters.models import Campaign, Character, Crew, Heritage


class PersonalCrewNameAutoAttachTest(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="gm", password="pw")
        self.p1 = User.objects.create_user(username="p1", password="pw")
        self.p2 = User.objects.create_user(username="p2", password="pw")
        self.campaign = Campaign.objects.create(name="Camp", gm=self.gm)
        self.campaign.players.add(self.p1, self.p2)
        self.heritage = Heritage.objects.create(name="Stand User")
        self.char1 = Character.objects.create(
            true_name="A",
            user=self.p1,
            campaign=self.campaign,
            heritage=self.heritage,
        )
        self.char2 = Character.objects.create(
            true_name="B",
            user=self.p2,
            campaign=self.campaign,
            heritage=self.heritage,
        )

    def _auth(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def test_first_player_creates_party_crew_via_personal_name(self):
        client = self._auth(self.p1)
        resp = client.patch(
            f"/api/characters/{self.char1.id}/",
            {"personal_crew_name": "The Lampblacks"},
            format="json",
        )
        self.assertEqual(
            resp.status_code, status.HTTP_200_OK, msg=resp.content
        )
        self.char1.refresh_from_db()
        self.assertIsNotNone(self.char1.crew_id)
        self.assertEqual(self.char1.personal_crew_name, "")
        crew = Crew.objects.get(campaign=self.campaign)
        self.assertEqual(crew.name, "The Lampblacks")

    def test_second_player_joins_existing_party_crew(self):
        existing = Crew.objects.create(name="Original", campaign=self.campaign)
        self.char1.crew = existing
        self.char1.save(update_fields=["crew"])
        client = self._auth(self.p2)
        resp = client.patch(
            f"/api/characters/{self.char2.id}/",
            {"personal_crew_name": "Doesnt Matter"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.char2.refresh_from_db()
        self.assertEqual(self.char2.crew_id, existing.id)
        self.assertEqual(self.char2.personal_crew_name, "")
        self.assertEqual(
            Crew.objects.filter(campaign=self.campaign).count(), 1
        )

    def test_joined_player_can_patch_shared_crew_sheet(self):
        client = self._auth(self.p1)
        client.patch(
            f"/api/characters/{self.char1.id}/",
            {"personal_crew_name": "Doves"},
            format="json",
        )
        crew = Crew.objects.get(campaign=self.campaign)
        resp = client.patch(
            f"/api/crews/{crew.id}/", {"rep": 5}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        crew.refresh_from_db()
        self.assertEqual(crew.rep, 5)

    def test_outsider_cannot_create_crew_for_other_campaign(self):
        outsider = User.objects.create_user(username="out", password="pw")
        client = self._auth(outsider)
        resp = client.post(
            "/api/crews/",
            {"name": "Heist", "campaign": self.campaign.id},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Crew.objects.filter(campaign=self.campaign).exists())

    def test_player_can_directly_create_crew_via_post(self):
        client = self._auth(self.p1)
        resp = client.post(
            "/api/crews/",
            {"name": "Cutters", "campaign": self.campaign.id},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Crew.objects.filter(campaign=self.campaign, name="Cutters").count(), 1
        )

    def test_blank_personal_crew_name_does_nothing(self):
        client = self._auth(self.p1)
        resp = client.patch(
            f"/api/characters/{self.char1.id}/",
            {"personal_crew_name": "   "},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.char1.refresh_from_db()
        self.assertIsNone(self.char1.crew_id)
        self.assertFalse(Crew.objects.filter(campaign=self.campaign).exists())
