from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Heritage
from characters.serializers import CharacterSerializer


class CharacterPermissionsAndCreatorTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.heritage = Heritage.objects.create(name="Human", base_hp=0, description="")

        self.gm = User.objects.create_user(username="gm", password="testpass123")
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.other = User.objects.create_user(username="other", password="testpass123")

        self.campaign = Campaign.objects.create(name="Table", gm=self.gm)
        self.character = Character.objects.create(
            user=self.owner,
            campaign=self.campaign,
            true_name="Owner Character",
            heritage=self.heritage,
        )

    def test_non_owner_non_gm_cannot_patch_character(self):
        self.client.force_authenticate(user=self.other)
        response = self.client.patch(
            f"/api/characters/{self.character.id}/",
            {"true_name": "Illicit edit"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_gm_can_patch_player_character(self):
        self.client.force_authenticate(user=self.gm)
        response = self.client.patch(
            f"/api/characters/{self.character.id}/",
            {"true_name": "Edited by GM"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.character.refresh_from_db()
        self.assertEqual(self.character.true_name, "Edited by GM")
        self.assertEqual(self.character.user_id, self.owner.id)

    def test_character_serializer_exposes_creator_username(self):
        data = CharacterSerializer(instance=self.character).data
        self.assertEqual(data.get("creator_username"), self.owner.username)
