"""Session.status sync when Campaign.active_session changes (GM PATCH)."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Session


class CampaignActiveSessionStatusSyncTests(TestCase):
    """PLANNED/ACTIVE/COMPLETED denormalized from live slot; settlement unchanged."""

    def setUp(self):
        self.gm = User.objects.create_user(username="gm_stat_sync", password="pw")
        self.campaign = Campaign.objects.create(name="Stat Camp", gm=self.gm)
        self.s1 = Session.objects.create(
            campaign=self.campaign, name="Ep1", status="PLANNED"
        )
        self.s2 = Session.objects.create(
            campaign=self.campaign, name="Ep2", status="PLANNED"
        )

    def _client(self):
        c = APIClient()
        c.force_authenticate(user=self.gm)
        return c

    def test_patch_first_live_sets_new_session_active(self):
        self.assertEqual(self.s1.status, "PLANNED")
        res = self._client().patch(
            f"/api/campaigns/{self.campaign.id}/",
            {"active_session": self.s1.id},
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content))
        self.s1.refresh_from_db()
        self.assertEqual(self.s1.status, "ACTIVE")

    def test_patch_clear_live_marks_previous_completed(self):
        self.campaign.active_session = self.s1
        self.campaign.save(update_fields=["active_session"])
        self.s1.status = "PLANNED"
        self.s1.save(update_fields=["status"])

        res = self._client().patch(
            f"/api/campaigns/{self.campaign.id}/",
            {
                "active_session": None,
                "skip_encoded_xp_settlement": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content))
        self.s1.refresh_from_db()
        self.assertEqual(self.s1.status, "COMPLETED")
        self.assertTrue(self.s1.auto_encoded_xp_settled)

    def test_patch_switch_live_completes_old_and_activates_new(self):
        self.campaign.active_session = self.s1
        self.campaign.save(update_fields=["active_session"])
        self.s1.status = "ACTIVE"
        self.s1.save(update_fields=["status"])

        res = self._client().patch(
            f"/api/campaigns/{self.campaign.id}/",
            {
                "active_session": self.s2.id,
                "skip_encoded_xp_settlement": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content))
        self.s1.refresh_from_db()
        self.s2.refresh_from_db()
        self.assertEqual(self.s1.status, "COMPLETED")
        self.assertEqual(self.s2.status, "ACTIVE")

    def test_reopen_completed_session_via_patch_sets_active(self):
        self.s1.status = "COMPLETED"
        self.s1.save(update_fields=["status"])
        res = self._client().patch(
            f"/api/campaigns/{self.campaign.id}/",
            {"active_session": self.s1.id},
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content))
        self.s1.refresh_from_db()
        self.assertEqual(self.s1.status, "ACTIVE")

    def test_patch_unrelated_campaign_field_does_not_flip_session_status(self):
        self.campaign.active_session = self.s1
        self.campaign.save(update_fields=["active_session"])
        self.s1.status = "ACTIVE"
        self.s1.save(update_fields=["status"])

        res = self._client().patch(
            f"/api/campaigns/{self.campaign.id}/",
            {"name": "Renamed Camp"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content))
        self.s1.refresh_from_db()
        self.assertEqual(self.s1.status, "ACTIVE")
