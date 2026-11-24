"""A player can be invited again after declining or leaving a campaign."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, CampaignInvitation


class CampaignReinviteTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="ri_gm", password="pw-ri-gm-1")
        self.player = User.objects.create_user(username="ri_p", password="pw-ri-p-1")
        self.camp = Campaign.objects.create(name="RI", gm=self.gm)
        self.client = APIClient()
        self.client.raise_request_exception = False
        self.client.force_authenticate(self.gm)

    def _invite(self):
        return self.client.post(
            f"/api/campaigns/{self.camp.id}/invite/",
            {"username": "ri_p"},
            format="json",
        )

    def _assert_pending_again(self, response):
        self.assertEqual(response.status_code, 201, response.content[:200])
        invitation = CampaignInvitation.objects.get(campaign=self.camp, invited_user=self.player)
        self.assertEqual(invitation.status, "pending")
        self.assertEqual(invitation.invited_by, self.gm)

    def test_reinvite_after_decline(self):
        CampaignInvitation.objects.create(
            campaign=self.camp, invited_user=self.player, invited_by=self.gm, status="declined"
        )
        self._assert_pending_again(self._invite())

    def test_reinvite_after_accepting_then_leaving(self):
        CampaignInvitation.objects.create(
            campaign=self.camp, invited_user=self.player, invited_by=self.gm, status="accepted"
        )
        self._assert_pending_again(self._invite())

    def test_first_invite_still_works(self):
        self._assert_pending_again(self._invite())

    def test_pending_invite_is_still_rejected(self):
        self.assertEqual(self._invite().status_code, 201)
        self.assertEqual(self._invite().status_code, 400)
        self.assertEqual(CampaignInvitation.objects.filter(campaign=self.camp).count(), 1)
