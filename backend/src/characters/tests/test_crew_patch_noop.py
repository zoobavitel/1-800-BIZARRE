"""A crew PATCH that changes nothing doesn't save, so it sends no crew event.

Every crew save broadcasts a "crew" event, and every open sheet refetches on
it. A sheet that re-sent unchanged crew values after each refetch looped
every ~2 s (2026-11-03). The frontend fix is #268; this is the backstop for
tabs still on old code.
"""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Crew, CrewHistory, Heritage


class CrewPatchNoopTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="cn_gm", password="pw-cn-gm-1")
        self.player = User.objects.create_user(username="cn_player", password="pw-cn-player-1")
        self.outsider = User.objects.create_user(username="cn_out", password="pw-cn-out-1")
        heritage, _ = Heritage.objects.get_or_create(name="Human", defaults={"base_hp": 0, "description": ""})
        self.campaign = Campaign.objects.create(name="CN Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        self.crew = Crew.objects.create(
            name="CN Crew", campaign=self.campaign, hold="weak", coin=2, level=1,
            notes="hello", upgrade_progress={"lair_boat": False},
        )
        Character.objects.create(
            user=self.player, campaign=self.campaign, crew=self.crew, true_name="CN PC", heritage=heritage
        )
        self.client = APIClient()

    def _sheet_body(self, **over):
        # The shape the sheet's crew autosave sends.
        body = {
            "rep": self.crew.rep, "turf": self.crew.turf, "level": self.crew.level,
            "wanted_level": self.crew.wanted_level, "coin": self.crew.coin,
            "hold": self.crew.hold, "description": self.crew.description,
            "notes": self.crew.notes, "upgrade_progress": dict(self.crew.upgrade_progress),
        }
        body.update(over)
        return body

    def _patch(self, user, body):
        self.client.force_authenticate(user)
        with patch("characters.signals_realtime.broadcast_campaign_update") as sent, \
                self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(f"/api/crews/{self.crew.pk}/", body, format="json")
        crew_events = [c for c in sent.call_args_list if c.args[1:2] == ("crew",)]
        return response, crew_events

    def test_unchanged_patch_sends_no_crew_event(self):
        for user in (self.player, self.gm):
            with self.subTest(user=user.username):
                response, events = self._patch(user, self._sheet_body())
                self.assertEqual(response.status_code, 200, response.content)
                self.assertEqual(events, [])
                self.assertEqual(response.data["coin"], 2)

    def test_changed_patch_saves_and_sends_one_event(self):
        response, events = self._patch(self.player, self._sheet_body(notes="changed"))
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(events), 1)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.notes, "changed")
        self.assertEqual(CrewHistory.objects.filter(crew=self.crew).count(), 1)

    def test_unchanged_patch_still_checks_permission(self):
        response, events = self._patch(self.outsider, self._sheet_body())
        self.assertIn(response.status_code, (403, 404), response.content)
        self.assertEqual(events, [])
