"""ExperienceTrackerViewSet.manual_award / manual_revoke endpoints.

Covers SRD-cap idempotency, owner+GM permissions, active-session requirement,
and revoke fallback from manual entries to auto-granted entries (so players
and GMs can also delete vice/trauma/heritage auto-records from the scorecard).
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    ExperienceTracker,
    Heritage,
    Session,
)


class XpTriggerToggleTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="gm_xpt", password="pw")
        self.player = User.objects.create_user(username="pl_xpt", password="pw")
        self.other = User.objects.create_user(username="oth_xpt", password="pw")
        self.campaign = Campaign.objects.create(name="XPT Camp", gm=self.gm)
        self.heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": "t"}
        )
        dots = {k: 0 for k in (
            "hunt", "study", "survey", "tinker",
            "finesse", "prowl", "skirmish", "wreck",
            "bizarre", "command", "consort", "sway",
        )}
        self.character = Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            true_name="PC",
            heritage=self.heritage,
            action_dots=dots,
            xp_clocks={"playbook": 0},
        )
        self.session = Session.objects.create(
            campaign=self.campaign, name="S1", status="ACTIVE"
        )
        self.campaign.active_session = self.session
        self.campaign.save(update_fields=["active_session"])
        self.client = APIClient()

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_award_increments_capped_at_two(self):
        self._auth(self.player)
        for _ in range(3):
            res = self.client.post(
                "/api/experience-tracker/award/",
                {"character": self.character.id, "trigger": "STANDOUT"},
                format="json",
            )
            self.assertEqual(res.status_code, 200)
        self.character.refresh_from_db()
        granted_total = sum(
            e.xp_gained
            for e in ExperienceTracker.objects.filter(
                character=self.character,
                session=self.session,
                trigger="STANDOUT",
            )
        )
        self.assertEqual(granted_total, 2)
        self.assertEqual(self.character.xp_clocks.get("playbook"), 2)

    def test_revoke_removes_latest_manual_entry(self):
        self._auth(self.player)
        self.client.post(
            "/api/experience-tracker/award/",
            {"character": self.character.id, "trigger": "BELIEFS"},
            format="json",
        )
        res = self.client.post(
            "/api/experience-tracker/revoke/",
            {"character": self.character.id, "trigger": "BELIEFS"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["revoked"], 1)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 0)
        self.assertFalse(
            ExperienceTracker.objects.filter(
                character=self.character,
                session=self.session,
                trigger="BELIEFS",
            ).exists()
        )

    def test_revoke_falls_back_to_auto_entry(self):
        # Auto-granted entry without manual-toggle prefix (e.g. vice overindulge)
        ExperienceTracker.objects.create(
            character=self.character,
            session=self.session,
            trigger="STRUGGLE",
            description="Auto: vice overindulgence",
            xp_gained=1,
        )
        self.character.xp_clocks = {"playbook": 1}
        self.character.save(update_fields=["xp_clocks"])

        self._auth(self.player)
        res = self.client.post(
            "/api/experience-tracker/revoke/",
            {"character": self.character.id, "trigger": "STRUGGLE"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["revoked"], 1)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 0)

    def test_revoke_noop_when_nothing_to_remove(self):
        self._auth(self.player)
        res = self.client.post(
            "/api/experience-tracker/revoke/",
            {"character": self.character.id, "trigger": "STANDOUT"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["revoked"], 0)

    def test_gm_can_toggle_on_behalf_of_player(self):
        self._auth(self.gm)
        res = self.client.post(
            "/api/experience-tracker/award/",
            {"character": self.character.id, "trigger": "STANDOUT"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

    def test_outsider_forbidden(self):
        self._auth(self.other)
        res = self.client.post(
            "/api/experience-tracker/award/",
            {"character": self.character.id, "trigger": "STANDOUT"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_requires_active_session(self):
        self.campaign.active_session = None
        self.campaign.save(update_fields=["active_session"])
        self._auth(self.player)
        res = self.client.post(
            "/api/experience-tracker/award/",
            {"character": self.character.id, "trigger": "STANDOUT"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_rejects_unknown_trigger(self):
        self._auth(self.player)
        res = self.client.post(
            "/api/experience-tracker/award/",
            {"character": self.character.id, "trigger": "BOGUS"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
