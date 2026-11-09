"""A PC belongs to one campaign; it moves to another only after it's removed.

Before this, assign-character and a sheet save moved a PC from campaign A
straight into campaign B, and the PC kept A's crew.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Crew, Heritage


class CharacterCampaignMoveTests(TestCase):
    def setUp(self):
        self.player = User.objects.create_user(username="mv_player", password="pw-mv-player-1")
        self.gm_a = User.objects.create_user(username="mv_gm_a", password="pw-mv-gm-a-1")
        self.gm_b = User.objects.create_user(username="mv_gm_b", password="pw-mv-gm-b-1")
        self.staff = User.objects.create_user(username="mv_staff", password="pw-mv-staff-1", is_staff=True)

        self.camp_a = Campaign.objects.create(name="Camp A", gm=self.gm_a)
        self.camp_b = Campaign.objects.create(name="Camp B", gm=self.gm_b)
        self.camp_a.players.add(self.player)
        self.camp_b.players.add(self.player)
        self.crew_a = Crew.objects.create(name="Crew A", campaign=self.camp_a)
        self.crew_b = Crew.objects.create(name="Crew B", campaign=self.camp_b)
        heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        self.pc = Character.objects.create(
            user=self.player, campaign=self.camp_a, crew=self.crew_a,
            true_name="Mover", heritage=heritage,
        )
        self.client = APIClient()

    def _assign(self, campaign, user=None):
        self.client.force_authenticate(user or self.player)
        return self.client.post(
            f"/api/campaigns/{campaign.pk}/assign-character/",
            {"character_id": self.pc.pk}, format="json",
        )

    def _unassign(self, campaign):
        self.client.force_authenticate(self.player)
        return self.client.post(
            f"/api/campaigns/{campaign.pk}/unassign-character/",
            {"character_id": self.pc.pk}, format="json",
        )

    def _patch_campaign(self, campaign, user=None):
        self.client.force_authenticate(user or self.player)
        return self.client.patch(
            f"/api/characters/{self.pc.pk}/",
            {"campaign": campaign.pk if campaign else None}, format="json",
        )

    def test_assign_refuses_a_pc_already_in_another_campaign(self):
        response = self._assign(self.camp_b)
        self.assertEqual(response.status_code, 409, response.content)
        self.assertIn("Camp A", str(response.data))
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.campaign_id, self.camp_a.pk)
        self.assertEqual(self.pc.crew_id, self.crew_a.pk)

    def test_sheet_save_refuses_moving_straight_to_another_campaign(self):
        response = self._patch_campaign(self.camp_b)
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn("campaign", response.data)
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.campaign_id, self.camp_a.pk)

    def test_unassign_then_assign_moves_and_drops_the_old_crew(self):
        self.assertEqual(self._unassign(self.camp_a).status_code, 200)
        self.assertEqual(self._assign(self.camp_b).status_code, 200)
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.campaign_id, self.camp_b.pk)
        self.assertNotEqual(self.pc.crew_id, self.crew_a.pk)

    def test_assigning_to_the_same_campaign_again_is_fine(self):
        self.assertEqual(self._assign(self.camp_a).status_code, 200)
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.campaign_id, self.camp_a.pk)
        self.assertEqual(self.pc.crew_id, self.crew_a.pk)

    def test_sheet_save_can_leave_and_rejoin(self):
        self.assertEqual(self._patch_campaign(None).status_code, 200)
        self.assertEqual(self._patch_campaign(self.camp_b).status_code, 200)
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.campaign_id, self.camp_b.pk)

    def test_unchanged_campaign_still_saves(self):
        response = self._patch_campaign(self.camp_a)
        self.assertEqual(response.status_code, 200, response.content)

    def test_staff_can_move_a_pc_directly(self):
        response = self._patch_campaign(self.camp_b, user=self.staff)
        self.assertEqual(response.status_code, 200, response.content)
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.campaign_id, self.camp_b.pk)
