"""PATCH /api/sessions/:id/ — skip encoded XP on COMPLETED; reopen COMPLETED→PLANNED."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Crew, Heritage, Roll, Session


class SessionPatchLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm_sess_patch", password="pw")
        self.player = User.objects.create_user(username="pl_sess_patch", password="pw")
        self.campaign = Campaign.objects.create(name="Patch Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="Patch Crew", campaign=self.campaign)
        self.h, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "t"},
        )
        dots = {
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
        }
        self.character = Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Patch PC",
            heritage=self.h,
            action_dots=dots,
            xp_clocks={"playbook": 4},
        )
        self.session = Session.objects.create(
            campaign=self.campaign,
            name="Ep",
            status="PLANNED",
        )

    def test_patch_status_completed_skip_encoded_xp(self):
        Roll.objects.create(
            character=self.character,
            session=self.session,
            roll_type="ACTION",
            action_name="skirmish",
            outcome="FULL_SUCCESS",
            description="[Abilities: test]",
        )
        self.client.force_authenticate(user=self.gm)
        res = self.client.patch(
            f"/api/sessions/{self.session.id}/",
            {
                "status": "COMPLETED",
                "skip_encoded_xp_settlement": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content))
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "COMPLETED")
        self.assertTrue(self.session.auto_encoded_xp_settled)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook", 0), 4)

    def test_patch_status_completed_applies_encoded_xp(self):
        # Encoded settle grants STRUGGLE from vice stress rolls (not [Abilities: …] tags).
        Roll.objects.create(
            character=self.character,
            session=self.session,
            roll_type="CLEAR_STRESS",
            action_name="vice gamble",
            outcome="FAILURE",
            description="stress clear failed",
        )
        self.client.force_authenticate(user=self.gm)
        res = self.client.patch(
            f"/api/sessions/{self.session.id}/",
            {"status": "COMPLETED", "skip_encoded_xp_settlement": False},
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content))
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "COMPLETED")
        self.assertTrue(self.session.auto_encoded_xp_settled)
        self.character.refresh_from_db()
        # STRUGGLE banks to free pool (not playbook clock).
        self.assertEqual(self.character.xp_clocks.get("playbook", 0), 4)
        self.assertGreater(self.character.unallocated_xp, 0)

    def test_patch_reopen_completed_to_planned(self):
        self.session.status = "COMPLETED"
        self.session.auto_encoded_xp_settled = True
        self.session.save(update_fields=["status", "auto_encoded_xp_settled"])
        self.client.force_authenticate(user=self.gm)
        res = self.client.patch(
            f"/api/sessions/{self.session.id}/",
            {"status": "PLANNED"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content))
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "PLANNED")
        self.assertFalse(self.session.auto_encoded_xp_settled)

    def test_patch_reopen_completed_with_session_date(self):
        self.session.status = "COMPLETED"
        self.session.auto_encoded_xp_settled = True
        self.session.save(update_fields=["status", "auto_encoded_xp_settled"])
        self.client.force_authenticate(user=self.gm)
        res = self.client.patch(
            f"/api/sessions/{self.session.id}/",
            {
                "session_date": "2026-06-01T12:00:00Z",
                "status": "PLANNED",
                "auto_encoded_xp_settled": False,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content))
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "PLANNED")
        self.assertFalse(self.session.auto_encoded_xp_settled)

    def test_patch_reopen_blocked_when_campaign_live_slot(self):
        self.session.status = "COMPLETED"
        self.session.auto_encoded_xp_settled = True
        self.session.save(update_fields=["status", "auto_encoded_xp_settled"])
        self.campaign.active_session = self.session
        self.campaign.save(update_fields=["active_session"])
        self.client.force_authenticate(user=self.gm)
        res = self.client.patch(
            f"/api/sessions/{self.session.id}/",
            {"status": "PLANNED"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, getattr(res, "data", res.content))
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "COMPLETED")
