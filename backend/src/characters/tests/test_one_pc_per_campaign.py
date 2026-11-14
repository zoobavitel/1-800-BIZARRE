"""A user has at most one PC in a campaign.

Unassigned PCs (no campaign) are unlimited. Before this, assign-character
and the sheet save let one user put several PCs in the same campaign.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Heritage


class OnePcPerCampaignTests(TestCase):
    def setUp(self):
        self.player = User.objects.create_user(username="one_player", password="pw-one-player-1")
        self.other = User.objects.create_user(username="one_other", password="pw-one-other-1")
        self.gm = User.objects.create_user(username="one_gm", password="pw-one-gm-1")
        self.camp = Campaign.objects.create(name="Camp One", gm=self.gm)
        self.camp.players.add(self.player, self.other)
        self.heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        self.first = self._pc(self.player, "First", campaign=self.camp)
        self.second = self._pc(self.player, "Second")
        self.client = APIClient()

    def _pc(self, user, name, campaign=None):
        return Character.objects.create(
            user=user, campaign=campaign, true_name=name, heritage=self.heritage
        )

    def _assign(self, pc, user=None):
        self.client.force_authenticate(user or pc.user)
        return self.client.post(
            f"/api/campaigns/{self.camp.pk}/assign-character/",
            {"character_id": pc.pk}, format="json",
        )

    def _patch_campaign(self, pc, campaign):
        self.client.force_authenticate(pc.user)
        return self.client.patch(
            f"/api/characters/{pc.pk}/",
            {"campaign": campaign.pk if campaign else None}, format="json",
        )

    def test_assign_refuses_a_second_pc_in_the_same_campaign(self):
        response = self._assign(self.second)
        self.assertEqual(response.status_code, 409, response.content)
        self.assertIn("First", str(response.data))
        self.second.refresh_from_db()
        self.assertIsNone(self.second.campaign_id)

    def test_sheet_save_refuses_a_second_pc_in_the_same_campaign(self):
        response = self._patch_campaign(self.second, self.camp)
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn("campaign", response.data)
        self.second.refresh_from_db()
        self.assertIsNone(self.second.campaign_id)

    def test_create_refuses_a_new_pc_straight_into_a_campaign_with_one(self):
        self.client.force_authenticate(self.player)
        response = self.client.post(
            "/api/characters/",
            {"true_name": "Third", "heritage": self.heritage.pk, "campaign": self.camp.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn("campaign", response.data)
        self.assertFalse(Character.objects.filter(true_name="Third").exists())

    def test_unassigned_pcs_are_unlimited(self):
        self._pc(self.player, "Spare 1")
        self.client.force_authenticate(self.player)
        response = self.client.post(
            "/api/characters/",
            {"true_name": "Spare 2", "heritage": self.heritage.pk}, format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)

    def test_other_players_each_get_one(self):
        theirs = self._pc(self.other, "Theirs")
        self.assertEqual(self._assign(theirs).status_code, 200)

    def test_the_assigned_pc_can_still_save_its_campaign(self):
        # The sheet autosave sends `campaign` on every save.
        self.assertEqual(self._patch_campaign(self.first, self.camp).status_code, 200)
        self.assertEqual(self._assign(self.first).status_code, 200)

    def test_swap_works_after_removing_the_first(self):
        self.assertEqual(self._patch_campaign(self.first, None).status_code, 200)
        self.assertEqual(self._assign(self.second).status_code, 200)
        self.second.refresh_from_db()
        self.assertEqual(self.second.campaign_id, self.camp.pk)
