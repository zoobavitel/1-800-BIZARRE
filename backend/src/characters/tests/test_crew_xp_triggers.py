"""Tests for Crew.session_xp_triggers PATCH gate + crew XP settlement service."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    Crew,
    ExperienceTracker,
    Session,
)
from characters.services.crew_xp_triggers import (
    credit_crew_xp_triggers_for_session,
)


class _BaseCrewXp(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="gm_cxp", password="pw")
        self.p1 = User.objects.create_user(username="p1_cxp", password="pw")
        self.p2 = User.objects.create_user(username="p2_cxp", password="pw")
        self.outsider = User.objects.create_user(username="out_cxp", password="pw")
        self.campaign = Campaign.objects.create(name="CXP Camp", gm=self.gm)
        self.campaign.players.add(self.p1, self.p2)
        self.crew = Crew.objects.create(
            name="CXP Crew", campaign=self.campaign, xp=0, xp_track_size=8
        )
        self.char1 = Character.objects.create(
            true_name="P1", user=self.p1, campaign=self.campaign, crew=self.crew
        )
        self.char2 = Character.objects.create(
            true_name="P2", user=self.p2, campaign=self.campaign, crew=self.crew
        )
        self.session = Session.objects.create(
            campaign=self.campaign, name="S1", status="ACTIVE"
        )
        self.campaign.active_session = self.session
        self.campaign.save(update_fields=["active_session"])

    def _client(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def _mark_xp(self, character, *, xp=1, trigger="PLAYBOOK_SPECIFIC"):
        return ExperienceTracker.objects.create(
            character=character,
            session=self.session,
            trigger=trigger,
            description="auto",
            xp_gained=xp,
        )


class CrewXpTriggerPatchPermissionTests(_BaseCrewXp):
    def test_player_can_toggle_only_after_earning_session_xp(self):
        client = self._client(self.p1)
        url = f"/api/crews/{self.crew.id}/"
        body = {
            "session_xp_triggers": {
                str(self.session.id): {"challenge": True}
            }
        }

        # No XP yet → blocked
        resp = client.patch(url, body, format="json")
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertIn("session_xp_triggers", resp.json())

        # Mark XP and retry → succeeds
        self._mark_xp(self.char1)
        resp = client.patch(url, body, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.crew.refresh_from_db()
        row = self.crew.session_xp_triggers[str(self.session.id)]
        self.assertTrue(row.get("challenge"))

    def test_teammate_xp_unlocks_toggles_for_other_player(self):
        """Any crew PC earning XP unlocks toggles for all crew members."""
        self._mark_xp(self.char1)
        client = self._client(self.p2)
        url = f"/api/crews/{self.crew.id}/"
        resp = client.patch(
            url,
            {"session_xp_triggers": {str(self.session.id): {"goals": True}}},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.crew.refresh_from_db()
        self.assertTrue(
            self.crew.session_xp_triggers[str(self.session.id)].get("goals")
        )

    def test_reputation_toggle_tracks_session_rep_contributions(self):
        self._mark_xp(self.char1)
        client = self._client(self.p1)
        sid = str(self.session.id)
        resp = client.patch(
            f"/api/crews/{self.crew.id}/",
            {"session_xp_triggers": {sid: {"reputation": True}}},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.crew.refresh_from_db()
        self.assertEqual(
            self.crew.session_rep_contributions[sid][str(self.char1.id)],
            1,
        )

    def test_player_cannot_edit_other_session_row(self):
        self._mark_xp(self.char1)
        old_session = Session.objects.create(
            campaign=self.campaign, name="S0", status="COMPLETED"
        )
        client = self._client(self.p1)
        resp = client.patch(
            f"/api/crews/{self.crew.id}/",
            {
                "session_xp_triggers": {
                    str(old_session.id): {"goals": True}
                }
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400, resp.content)

    def test_player_cannot_set_credited(self):
        self._mark_xp(self.char1)
        client = self._client(self.p1)
        resp = client.patch(
            f"/api/crews/{self.crew.id}/",
            {
                "session_xp_triggers": {
                    str(self.session.id): {
                        "challenge": True,
                        "credited": True,  # stripped server-side
                    }
                }
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.crew.refresh_from_db()
        row = self.crew.session_xp_triggers[str(self.session.id)]
        self.assertTrue(row.get("challenge"))
        self.assertNotIn("credited", row)

    def test_gm_can_toggle_any_session_without_xp_gate(self):
        client = self._client(self.gm)
        resp = client.patch(
            f"/api/crews/{self.crew.id}/",
            {
                "session_xp_triggers": {
                    str(self.session.id): {
                        "challenge": True,
                        "reputation": True,
                        "goals": True,
                    }
                }
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.crew.refresh_from_db()
        row = self.crew.session_xp_triggers[str(self.session.id)]
        self.assertTrue(row["challenge"] and row["reputation"] and row["goals"])

    def test_player_patch_merges_with_existing_rows(self):
        self._mark_xp(self.char1)
        existing_sid = "999"  # not the active session, but an old credited row
        self.crew.session_xp_triggers = {
            existing_sid: {
                "challenge": True,
                "reputation": True,
                "goals": True,
                "credited": True,
            }
        }
        self.crew.save(update_fields=["session_xp_triggers"])
        client = self._client(self.p1)
        resp = client.patch(
            f"/api/crews/{self.crew.id}/",
            {
                "session_xp_triggers": {
                    str(self.session.id): {"reputation": True}
                }
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.crew.refresh_from_db()
        # Old credited row preserved untouched.
        self.assertEqual(
            self.crew.session_xp_triggers[existing_sid],
            {
                "challenge": True,
                "reputation": True,
                "goals": True,
                "credited": True,
            },
        )
        self.assertTrue(
            self.crew.session_xp_triggers[str(self.session.id)]["reputation"]
        )

    def test_outsider_cannot_patch(self):
        client = self._client(self.outsider)
        resp = client.patch(
            f"/api/crews/{self.crew.id}/",
            {
                "session_xp_triggers": {
                    str(self.session.id): {"challenge": True}
                }
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 404, resp.content)


class CrewXpTriggerSettlementTests(_BaseCrewXp):
    def test_credit_adds_one_xp_per_toggled_trigger(self):
        self.crew.session_xp_triggers = {
            str(self.session.id): {
                "challenge": True,
                "reputation": False,
                "goals": True,
            }
        }
        self.crew.save(update_fields=["session_xp_triggers"])
        out = credit_crew_xp_triggers_for_session(self.session, self.gm)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.xp, 2)
        self.assertTrue(
            self.crew.session_xp_triggers[str(self.session.id)]["credited"]
        )
        self.assertEqual(out["applied"][0]["xp_granted"], 2)

    def test_credit_is_idempotent(self):
        self.crew.session_xp_triggers = {
            str(self.session.id): {"challenge": True, "reputation": True}
        }
        self.crew.save(update_fields=["session_xp_triggers"])
        credit_crew_xp_triggers_for_session(self.session, self.gm)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.xp, 2)
        # Re-running does nothing — row already credited.
        credit_crew_xp_triggers_for_session(self.session, self.gm)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.xp, 2)

    def test_credit_caps_at_xp_track_size(self):
        self.crew.xp = 7
        self.crew.xp_track_size = 8
        self.crew.session_xp_triggers = {
            str(self.session.id): {
                "challenge": True,
                "reputation": True,
                "goals": True,
            }
        }
        self.crew.save(update_fields=["xp", "xp_track_size", "session_xp_triggers"])
        credit_crew_xp_triggers_for_session(self.session, self.gm)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.xp, 8)
        self.assertTrue(
            self.crew.session_xp_triggers[str(self.session.id)]["credited"]
        )

    def test_empty_row_still_marked_credited(self):
        self.crew.session_xp_triggers = {
            str(self.session.id): {
                "challenge": False,
                "reputation": False,
                "goals": False,
            }
        }
        self.crew.save(update_fields=["session_xp_triggers"])
        credit_crew_xp_triggers_for_session(self.session, self.gm)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.xp, 0)
        self.assertTrue(
            self.crew.session_xp_triggers[str(self.session.id)]["credited"]
        )

    def test_credit_adds_session_rep_contributions_to_crew_rep(self):
        sid = str(self.session.id)
        self.crew.rep = 2
        self.crew.session_xp_triggers = {sid: {"challenge": True}}
        self.crew.session_rep_contributions = {sid: {str(self.char1.id): 3}}
        self.crew.save(
            update_fields=["rep", "session_xp_triggers", "session_rep_contributions"]
        )
        credit_crew_xp_triggers_for_session(self.session, self.gm)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.rep, 5)
        self.assertNotIn(sid, self.crew.session_rep_contributions or {})

    def test_credit_runs_on_campaign_active_session_change(self):
        """End-to-end: PATCH campaign.active_session → service credits crew XP."""
        self.crew.session_xp_triggers = {
            str(self.session.id): {"challenge": True, "goals": True}
        }
        self.crew.save(update_fields=["session_xp_triggers"])
        next_session = Session.objects.create(
            campaign=self.campaign, name="S2", status="ACTIVE"
        )
        client = self._client(self.gm)
        # Skip encoded PC XP to isolate this test from settle_encoded_session_xp.
        resp = client.patch(
            f"/api/campaigns/{self.campaign.id}/",
            {
                "active_session": next_session.id,
                "skip_encoded_xp_settlement": True,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.session.refresh_from_db()
        next_session.refresh_from_db()
        self.assertEqual(self.session.status, "COMPLETED")
        self.assertEqual(next_session.status, "ACTIVE")
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.xp, 2)
        self.assertTrue(
            self.crew.session_xp_triggers[str(self.session.id)]["credited"]
        )
