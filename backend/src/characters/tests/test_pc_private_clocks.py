"""PC private clocks: who sees a clock is chosen per clock.

The GM and the clock's creator always see it. "All players" is the
existing flag (`visible_to_players` on GM clocks, `visible_to_party` on a
player's clock). Otherwise only the players listed in `visible_to` see it.

Before this, a GM clock on player2's PC with "Visible to players" off was
still readable by player1 through player2's sheet or the clock API.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Heritage, ProgressClock, Session


class PcPrivateClockTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="pv_gm", password="pw-pv-gm-1")
        self.p1 = User.objects.create_user(username="pv_p1", password="pw-pv-p1-1")
        self.p2 = User.objects.create_user(username="pv_p2", password="pw-pv-p2-1")
        self.p3 = User.objects.create_user(username="pv_p3", password="pw-pv-p3-1")
        self.outsider = User.objects.create_user(username="pv_out", password="pw-pv-out-1")
        self.camp = Campaign.objects.create(name="PV Camp", gm=self.gm)
        self.camp.players.add(self.p1, self.p2, self.p3)
        self.session = Session.objects.create(campaign=self.camp, name="PV S1", status="ACTIVE")
        self.camp.active_session = self.session
        self.camp.save()
        heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        self.pc1 = Character.objects.create(
            user=self.p1, campaign=self.camp, true_name="PV One", heritage=heritage
        )
        self.pc2 = Character.objects.create(
            user=self.p2, campaign=self.camp, true_name="PV Two", heritage=heritage
        )
        Character.objects.create(
            user=self.p3, campaign=self.camp, true_name="PV Three", heritage=heritage
        )
        self.client = APIClient()

    # Helpers

    def _as(self, user):
        self.client.force_authenticate(user)
        return self.client

    def _gm_clock(self, name, **fields):
        body = {"name": name, "clock_type": "DANGER", "max_segments": 4,
                "campaign": self.camp.id, "character": self.pc2.id, **fields}
        r = self._as(self.gm).post("/api/progress-clocks/", body, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return r.data["id"]

    def _sees(self, user, clock_id):
        """Where `user` can see the clock: list, sheet, detail, campaign."""
        c = self._as(user)
        found = {}
        listed = c.get(f"/api/progress-clocks/?campaign={self.camp.id}").data
        listed = listed.get("results", listed) if isinstance(listed, dict) else listed
        found["list"] = any(x["id"] == clock_id for x in listed)
        unscoped = c.get("/api/progress-clocks/").data
        unscoped = unscoped.get("results", unscoped) if isinstance(unscoped, dict) else unscoped
        found["unscoped"] = any(x["id"] == clock_id for x in unscoped)
        found["detail"] = c.get(f"/api/progress-clocks/{clock_id}/").status_code == 200
        sheet = c.get(f"/api/characters/{self.pc2.id}/")
        found["sheet"] = sheet.status_code == 200 and any(
            x["id"] == clock_id for x in sheet.data.get("progress_clocks", [])
        )
        camp = c.get(f"/api/campaigns/{self.camp.id}/")
        found["campaign"] = camp.status_code == 200 and any(
            x["id"] == clock_id for x in camp.data.get("progress_clocks", [])
        )
        return found

    def assertSeesAll(self, user, clock_id):
        found = self._sees(user, clock_id)
        # The campaign payload lists campaign clocks; PC clocks may or may not
        # be in it, so only the other four must all be true.
        for where in ("list", "unscoped", "detail", "sheet"):
            self.assertTrue(found[where], f"{user.username} should see it in {where}: {found}")

    def assertSeesNone(self, user, clock_id):
        found = self._sees(user, clock_id)
        self.assertFalse(any(found.values()), f"{user.username} sees it: {found}")

    # Checks from the story

    def test_this_player_only(self):
        cid = self._gm_clock("For two", visible_to=[self.p2.id])
        self.assertSeesAll(self.p2, cid)
        self.assertSeesAll(self.gm, cid)
        self.assertSeesNone(self.p1, cid)
        self.assertSeesNone(self.outsider, cid)

    def test_gm_only_on_a_pc(self):
        cid = self._gm_clock("Secret", visible_to=[])
        self.assertSeesAll(self.gm, cid)
        self.assertSeesNone(self.p2, cid)
        self.assertSeesNone(self.p1, cid)

    def test_all_players(self):
        cid = self._gm_clock("Open", visible_to_players=True)
        self.assertSeesAll(self.p1, cid)
        self.assertSeesAll(self.p2, cid)

    def test_old_hidden_gm_clock_on_a_pc_is_now_gm_only(self):
        old = ProgressClock.objects.create(
            name="Old hidden", clock_type="DANGER", campaign=self.camp,
            character=self.pc2, created_by=self.gm, visible_to_players=False,
        )
        self.assertSeesNone(self.p2, old.id)
        self.assertSeesNone(self.p1, old.id)

    def test_player_shares_their_clock_with_one_crewmate(self):
        r = self._as(self.p1).post(
            "/api/progress-clocks/",
            {"name": "Mine", "clock_type": "PROJECT", "max_segments": 6,
             "campaign": self.camp.id, "character": self.pc1.id,
             "visible_to": [self.p2.id]},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        cid = r.data["id"]
        for user, sees in ((self.p1, True), (self.p2, True), (self.gm, True), (self.p3, False)):
            c = self._as(user)
            got = c.get(f"/api/progress-clocks/{cid}/").status_code == 200
            self.assertEqual(got, sees, user.username)

    def test_gm_reveals_a_players_private_clock_to_everyone(self):
        clock = ProgressClock.objects.create(
            name="P1 secret", clock_type="PROJECT", campaign=self.camp,
            character=self.pc1, created_by=self.p1,
        )
        self.assertEqual(self._as(self.p3).get(f"/api/progress-clocks/{clock.id}/").status_code, 404)
        r = self._as(self.gm).patch(
            f"/api/progress-clocks/{clock.id}/", {"visible_to_party": True}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._as(self.p3).get(f"/api/progress-clocks/{clock.id}/").status_code, 200)

    # Edge cases

    def test_sheet_save_keeps_clocks_the_player_cannot_see(self):
        cid = self._gm_clock("Secret", visible_to=[])
        sheet = self._as(self.p2).get(f"/api/characters/{self.pc2.id}/").data
        r = self._as(self.p2).patch(
            f"/api/characters/{self.pc2.id}/",
            {"progress_clocks": sheet["progress_clocks"]}, format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(ProgressClock.objects.filter(id=cid).exists())

    def test_sheet_save_cannot_edit_a_hidden_clock_by_id(self):
        cid = self._gm_clock("Secret", visible_to=[])
        r = self._as(self.p2).patch(
            f"/api/characters/{self.pc2.id}/",
            {"progress_clocks": [{"id": cid, "name": "Peeked", "max_segments": 4, "filled_segments": 4}]},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        clock = ProgressClock.objects.get(id=cid)
        self.assertEqual(clock.name, "Secret")
        self.assertEqual(clock.filled_segments, 0)
        # And no copy was made in its place.
        self.assertEqual(self.pc2.progress_clocks.count(), 1)

    def test_sheet_save_does_not_drop_the_picked_players(self):
        # An older sheet sends no `visible_to`; the list stays as it was.
        cid = self._gm_clock("For two", visible_to=[self.p2.id])
        sheet = self._as(self.gm).get(f"/api/characters/{self.pc2.id}/").data
        rows = [{k: v for k, v in row.items() if k != "visible_to"} for row in sheet["progress_clocks"]]
        self._as(self.gm).patch(
            f"/api/characters/{self.pc2.id}/", {"progress_clocks": rows}, format="json"
        )
        self.assertEqual(
            list(ProgressClock.objects.get(id=cid).visible_to.values_list("id", flat=True)),
            [self.p2.id],
        )

    def test_player_cannot_change_who_sees_a_gm_clock(self):
        cid = self._gm_clock("For two", visible_to=[self.p2.id])
        r = self._as(self.p2).patch(
            f"/api/progress-clocks/{cid}/", {"visible_to": [self.p1.id, self.p2.id]}, format="json"
        )
        self.assertEqual(r.status_code, 403, r.content)

    def test_only_campaign_players_can_be_picked(self):
        r = self._as(self.gm).post(
            "/api/progress-clocks/",
            {"name": "X", "clock_type": "DANGER", "max_segments": 4,
             "campaign": self.camp.id, "visible_to": [self.outsider.id]},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("visible_to", r.data)

    def test_a_picked_player_can_tick_it(self):
        cid = self._gm_clock("For two", visible_to=[self.p2.id])
        r = self._as(self.p2).patch(
            f"/api/progress-clocks/{cid}/", {"filled_segments": 1}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.content)
        r = self._as(self.p1).patch(
            f"/api/progress-clocks/{cid}/", {"filled_segments": 2}, format="json"
        )
        self.assertEqual(r.status_code, 404, r.content)
