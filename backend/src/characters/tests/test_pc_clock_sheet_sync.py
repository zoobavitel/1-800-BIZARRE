"""Sheet saves and PC clocks.

A deleted clock stays deleted when an old copy of the sheet saves again. A
player can tick a GM's clock on their PC, but not rename, resize or delete it.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Heritage, ProgressClock


class PcClockSheetSyncTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="sync_gm", password="pw-sync-gm-1")
        self.p1 = User.objects.create_user(username="sync_p1", password="pw-sync-p1-1")
        self.camp = Campaign.objects.create(name="Sync Camp", gm=self.gm)
        self.camp.players.add(self.p1)
        heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        self.pc = Character.objects.create(
            user=self.p1, campaign=self.camp, true_name="Sync One", heritage=heritage
        )
        self.client = APIClient()

    def _clock(self, name, creator, **fields):
        return ProgressClock.objects.create(
            name=name,
            clock_type="DANGER",
            max_segments=4,
            campaign=self.camp,
            character=self.pc,
            created_by=creator,
            **fields,
        )

    def _row(self, clock, **changes):
        return {
            "id": clock.id,
            "name": clock.name,
            "clock_type": clock.clock_type,
            "max_segments": clock.max_segments,
            "filled_segments": clock.filled_segments,
            "visible_to_party": clock.visible_to_party,
            "visible_to_players": clock.visible_to_players,
            **changes,
        }

    def _save(self, user, rows):
        self.client.force_authenticate(user)
        r = self.client.patch(
            f"/api/characters/{self.pc.id}/", {"progress_clocks": rows}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.content)
        return r

    def test_stale_save_does_not_bring_back_a_deleted_clock(self):
        keep = self._clock("Keep", self.p1)
        gone = self._clock("Gone", self.p1)
        stale = [self._row(keep), self._row(gone)]
        self._save(self.p1, [self._row(keep)])
        self.assertFalse(ProgressClock.objects.filter(id=gone.id).exists())

        self._save(self.p1, stale)

        names = list(
            ProgressClock.objects.filter(character=self.pc).values_list("name", flat=True)
        )
        self.assertEqual(names, ["Keep"])

    def test_clock_with_no_id_is_still_created(self):
        self._save(
            self.p1,
            [{"name": "New", "clock_type": "DANGER", "max_segments": 6, "filled_segments": 0}],
        )
        clock = ProgressClock.objects.get(character=self.pc, name="New")
        self.assertEqual(clock.created_by_id, self.p1.id)

    def test_player_can_tick_a_gm_clock_on_their_pc(self):
        clock = self._clock("GM clock", self.gm, visible_to_players=True)
        self._save(self.p1, [self._row(clock, filled_segments=2)])
        clock.refresh_from_db()
        self.assertEqual(clock.filled_segments, 2)

    def test_player_cannot_rename_or_resize_a_gm_clock_through_save(self):
        clock = self._clock("GM clock", self.gm, visible_to_players=True)
        self._save(self.p1, [self._row(clock, name="Hacked", max_segments=12)])
        clock.refresh_from_db()
        self.assertEqual(clock.name, "GM clock")
        self.assertEqual(clock.max_segments, 4)

    def test_player_cannot_delete_a_gm_clock_by_leaving_it_out(self):
        clock = self._clock("GM clock", self.gm, visible_to_players=True)
        self._save(self.p1, [])
        self.assertTrue(ProgressClock.objects.filter(id=clock.id).exists())

    def test_player_can_edit_and_delete_their_own_clock(self):
        mine = self._clock("Mine", self.p1)
        self._save(self.p1, [self._row(mine, name="Renamed", max_segments=8)])
        mine.refresh_from_db()
        self.assertEqual((mine.name, mine.max_segments), ("Renamed", 8))
        self._save(self.p1, [])
        self.assertFalse(ProgressClock.objects.filter(id=mine.id).exists())

    def test_gm_can_edit_and_delete_a_players_clock(self):
        mine = self._clock("Mine", self.p1)
        self._save(self.gm, [self._row(mine, name="GM edit")])
        mine.refresh_from_db()
        self.assertEqual(mine.name, "GM edit")
        self._save(self.gm, [])
        self.assertFalse(ProgressClock.objects.filter(id=mine.id).exists())
