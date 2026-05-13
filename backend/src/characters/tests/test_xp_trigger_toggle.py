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

    def test_award_records_player_attribution(self):
        self._auth(self.player)
        res = self.client.post(
            "/api/experience-tracker/award/",
            {"character": self.character.id, "trigger": "BELIEFS"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        entry = ExperienceTracker.objects.filter(
            character=self.character, trigger="BELIEFS"
        ).latest("id")
        self.assertEqual(entry.award_source, "PLAYER")
        self.assertEqual(entry.awarded_by_id, self.player.id)
        self.assertEqual(entry.clock_key, "playbook")

    def test_award_records_gm_attribution_when_gm_awards(self):
        self._auth(self.gm)
        res = self.client.post(
            "/api/experience-tracker/award/",
            {"character": self.character.id, "trigger": "STRUGGLE"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        entry = ExperienceTracker.objects.filter(
            character=self.character, trigger="STRUGGLE"
        ).latest("id")
        self.assertEqual(entry.award_source, "GM")
        self.assertEqual(entry.awarded_by_id, self.gm.id)

    def test_delete_endpoint_removes_entry_and_rolls_back_clock(self):
        entry = ExperienceTracker.objects.create(
            character=self.character,
            session=self.session,
            trigger="STRUGGLE",
            description="Auto: trauma",
            xp_gained=1,
            award_source="AUTO",
            clock_key="playbook",
        )
        self.character.xp_clocks = {"playbook": 3}
        self.character.save(update_fields=["xp_clocks"])
        self._auth(self.gm)
        res = self.client.delete(f"/api/experience-tracker/{entry.id}/")
        self.assertEqual(res.status_code, 204)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 2)
        self.assertFalse(
            ExperienceTracker.objects.filter(pk=entry.id).exists()
        )

    def test_delete_endpoint_uses_entry_clock_key_for_attribute_track(self):
        entry = ExperienceTracker.objects.create(
            character=self.character,
            session=self.session,
            trigger="DESPERATE_ROLL",
            description="Desperate roll: Hunt",
            xp_gained=1,
            award_source="AUTO",
            clock_key="insight",
        )
        self.character.xp_clocks = {"playbook": 1, "insight": 2}
        self.character.save(update_fields=["xp_clocks"])
        self._auth(self.player)
        res = self.client.delete(f"/api/experience-tracker/{entry.id}/")
        self.assertEqual(res.status_code, 204)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("insight"), 1)
        self.assertEqual(self.character.xp_clocks.get("playbook"), 1)

    def test_delete_endpoint_rolls_back_pool_for_session_end_rows(self):
        self.character.unallocated_xp = 3
        self.character.save(update_fields=["unallocated_xp"])
        entry = ExperienceTracker.objects.create(
            character=self.character,
            session=self.session,
            trigger="MANUAL",
            description="Session end (pool): Stand Development session XP (+2).",
            xp_gained=2,
            award_source="AUTO",
            clock_key="",
        )
        self._auth(self.gm)
        res = self.client.delete(f"/api/experience-tracker/{entry.id}/")
        self.assertEqual(res.status_code, 204)
        self.character.refresh_from_db()
        self.assertEqual(self.character.unallocated_xp, 1)

    def test_delete_endpoint_forbidden_for_outsider(self):
        entry = ExperienceTracker.objects.create(
            character=self.character,
            session=self.session,
            trigger="STRUGGLE",
            description="x",
            xp_gained=1,
            award_source="AUTO",
            clock_key="playbook",
        )
        self._auth(self.other)
        res = self.client.delete(f"/api/experience-tracker/{entry.id}/")
        self.assertIn(res.status_code, (403, 404))
        self.assertTrue(
            ExperienceTracker.objects.filter(pk=entry.id).exists()
        )
