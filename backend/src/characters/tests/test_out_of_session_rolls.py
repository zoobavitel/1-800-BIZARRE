"""Rolls made with no live session still reach the campaign's roll list."""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    ExperienceTracker,
    Heritage,
    Roll,
    RollHistory,
    Session,
)


class OutOfSessionRollTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="oos_gm", password="pw-oos-gm-1")
        self.p1 = User.objects.create_user(username="oos_p1", password="pw-oos-p1-1")
        self.p2 = User.objects.create_user(username="oos_p2", password="pw-oos-p2-1")
        self.outsider = User.objects.create_user(username="oos_x", password="pw-oos-x-1")
        self.camp = Campaign.objects.create(name="OOS", gm=self.gm)
        self.camp.players.add(self.p1, self.p2)
        heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        self.pc = Character.objects.create(
            user=self.p1,
            campaign=self.camp,
            true_name="OOS One",
            heritage=heritage,
            action_dots={"hunt": 2},
        )
        self.loner = Character.objects.create(
            user=self.p1, true_name="OOS Loner", heritage=heritage
        )
        self.client = APIClient()

    def _as(self, user):
        self.client.force_authenticate(user)
        return self.client

    def _roll(self, character=None, **extra):
        body = {"action": "hunt", "position": "desperate", "effect": "standard", **extra}
        pc = character or self.pc
        return self._as(self.p1).post(
            f"/api/characters/{pc.id}/roll-action/", body, format="json"
        )

    def _listed(self, user, query):
        data = self._as(user).get(f"/api/rolls/?{query}").data
        rows = data if isinstance(data, list) else data.get("results", [])
        return {r["id"] for r in rows}

    def test_sheet_roll_with_no_session_is_saved_to_the_campaign(self):
        r = self._roll()
        self.assertEqual(r.status_code, 200, r.content)
        roll = Roll.objects.get(pk=r.data["roll_id"])
        self.assertIsNone(roll.session_id)
        self.assertEqual(roll.history_entry.campaign_id, self.camp.id)

    def test_it_awards_no_xp(self):
        r = self._roll()
        self.assertEqual(r.data["xp_gained"], 0)
        self.assertFalse(ExperienceTracker.objects.filter(character=self.pc).exists())

    def test_gm_and_players_see_it_outsiders_do_not(self):
        rid = self._roll().data["roll_id"]
        query = f"campaign={self.camp.id}"
        self.assertIn(rid, self._listed(self.gm, query))
        self.assertIn(rid, self._listed(self.p2, query))
        self.assertNotIn(rid, self._listed(self.outsider, query))

    def test_out_of_session_filter(self):
        rid = self._roll().data["roll_id"]
        session = Session.objects.create(campaign=self.camp, name="S")
        live = self._roll(session_id=session.id).data["roll_id"]
        got = self._listed(self.gm, f"campaign={self.camp.id}&out_of_session=1")
        self.assertIn(rid, got)
        self.assertNotIn(live, got)

    def test_character_with_no_campaign_saves_nothing(self):
        r = self._roll(character=self.loner)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIsNone(r.data["roll_id"])

    def test_it_tells_the_campaign(self):
        with patch(
            "characters.signals_realtime.broadcast_campaign_update"
        ) as sent, self.captureOnCommitCallbacks(execute=True):
            self._roll()
        self.assertTrue(
            any(c.args[:2] == (self.camp.id, "roll") for c in sent.call_args_list)
        )

    def test_gm_can_delete_it(self):
        rid = self._roll().data["roll_id"]
        r = self._as(self.gm).delete(f"/api/rolls/{rid}/")
        self.assertEqual(r.status_code, 204, r.content)

    def test_logged_resistance_does_not_charge_stress_on_the_server(self):
        self.pc.stress = 1
        self.pc.save(update_fields=["stress"])
        r = self._as(self.p1).post(
            "/api/rolls/",
            {
                "character": self.pc.id,
                "roll_type": "RESISTANCE",
                "action_name": "insight",
                "dice_pool": 1,
                "results": [4],
                "outcome": "PARTIAL_SUCCESS",
                "roller_stress_spent": 2,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.stress, 1)
        self.assertEqual(
            RollHistory.objects.get(roll_id=r.data["id"]).campaign_id, self.camp.id
        )

    def test_other_players_cannot_log_for_your_pc(self):
        r = self._as(self.p2).post(
            "/api/rolls/",
            {"character": self.pc.id, "roll_type": "ACTION", "results": [4], "outcome": "PARTIAL_SUCCESS"},
            format="json",
        )
        self.assertEqual(r.status_code, 403)
