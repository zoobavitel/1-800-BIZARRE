"""Campaign.allow_character_assignment default + GM PATCH."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign


class CampaignAllowCharacterAssignmentTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user("aca_gm", "aca_gm@test.com", "pw")
        self.player = User.objects.create_user("aca_pl", "aca_pl@test.com", "pw")
        self.campaign = Campaign.objects.create(name="Assign Gate Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        self.url = f"/api/campaigns/{self.campaign.id}/"

    def test_default_false_on_retrieve(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        r = client.get(self.url)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertIn("allow_character_assignment", r.data)
        self.assertIs(r.data["allow_character_assignment"], False)

    def test_gm_can_patch_true(self):
        client = APIClient()
        client.force_authenticate(self.gm)
        r = client.patch(
            self.url,
            {"allow_character_assignment": True},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertIs(r.data.get("allow_character_assignment"), True)
        self.campaign.refresh_from_db()
        self.assertTrue(self.campaign.allow_character_assignment)

    def test_non_gm_cannot_patch(self):
        client = APIClient()
        client.force_authenticate(self.player)
        r = client.patch(
            self.url,
            {"allow_character_assignment": True},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.campaign.refresh_from_db()
        self.assertFalse(self.campaign.allow_character_assignment)
