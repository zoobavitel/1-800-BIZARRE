"""NPC visibility defaults and per-player NPC clocks.

A new NPC is hidden from players until the GM turns See on, including through
its faction. An NPC clock can be limited to picked players, who see it while
the NPC is visible. Session reveals can't show it to anyone else.
"""

from types import SimpleNamespace

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    Crew,
    Faction,
    Heritage,
    NPC,
    Session,
    SessionNPCInvolvement,
    ShowcasedNPC,
)
from characters.serializers import ShowcasedNPCSerializer


class NpcVisibilityBase(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="nv_gm", password="pw-nv-gm-1")
        self.p1 = User.objects.create_user(username="nv_p1", password="pw-nv-p1-1")
        self.p2 = User.objects.create_user(username="nv_p2", password="pw-nv-p2-1")
        self.p3 = User.objects.create_user(username="nv_p3", password="pw-nv-p3-1")
        self.camp = Campaign.objects.create(name="NV Camp", gm=self.gm)
        self.camp.players.add(self.p1, self.p2, self.p3)
        self.session = Session.objects.create(campaign=self.camp, name="NV S1", status="ACTIVE")
        self.camp.active_session = self.session
        self.camp.save()
        self.crew = Crew.objects.create(name="NV Crew", campaign=self.camp)
        heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        for user, crew in ((self.p1, self.crew), (self.p2, self.crew), (self.p3, None)):
            Character.objects.create(
                user=user,
                campaign=self.camp,
                crew=crew,
                true_name=f"PC {user.username}",
                heritage=heritage,
            )
        self.faction = Faction.objects.create(
            name="NV Faction", campaign=self.camp, visible_to_players=True, players_see_npcs=True
        )
        self.client = APIClient()

    def _as(self, user):
        self.client.force_authenticate(user)
        return self.client


class NewNpcHiddenTests(NpcVisibilityBase):
    def _create(self, **extra):
        r = self._as(self.gm).post(
            "/api/npcs/",
            {"name": "Fresh", "campaign": self.camp.id, "faction": self.faction.id, **extra},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        return r.data["id"]

    def test_new_npc_defaults_to_hidden(self):
        self.assertFalse(NPC.objects.get(id=self._create()).visible_to_players)

    def test_player_cannot_open_a_new_npc(self):
        npc_id = self._create()
        self.assertEqual(self._as(self.p1).get(f"/api/npcs/{npc_id}/").status_code, 404)

    def test_new_npc_not_in_player_npc_list_or_campaign_roster(self):
        npc_id = self._create()
        listed = self._as(self.p1).get(f"/api/npcs/?campaign={self.camp.id}").data
        listed = listed.get("results", listed) if isinstance(listed, dict) else listed
        self.assertNotIn(npc_id, [n["id"] for n in listed])
        camp = self._as(self.p1).get(f"/api/campaigns/{self.camp.id}/").data
        self.assertNotIn(npc_id, [n["id"] for n in camp.get("campaign_npcs", [])])

    def test_new_npc_not_shown_through_its_faction(self):
        npc_id = self._create()
        data = self._as(self.p1).get(f"/api/factions/{self.faction.id}/").data
        self.assertNotIn(npc_id, [n.get("id") for n in data.get("npcs", [])])

    def test_gm_can_reveal_it(self):
        npc_id = self._create()
        r = self._as(self.gm).patch(
            f"/api/npcs/{npc_id}/", {"visible_to_players": True}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._as(self.p1).get(f"/api/npcs/{npc_id}/").status_code, 200)


class NpcPickedClockTests(NpcVisibilityBase):
    def setUp(self):
        super().setUp()
        self.npc = NPC.objects.create(
            name="Clocked",
            campaign=self.camp,
            crew=self.crew,
            creator=self.gm,
            visible_to_players=True,
            conflict_clocks=[
                {"id": 1, "name": "For P1", "segments": 6, "filled": 1, "visible_to": [self.p1.id]},
                {"id": 2, "name": "Open", "segments": 4, "filled": 0},
            ],
            alt_clocks=[
                {"id": 3, "name": "Alt P2", "segments": 4, "filled": 0, "visible_to": [self.p2.id]},
            ],
        )

    def _npc_clock_names(self, user):
        data = self._as(user).get(f"/api/npcs/{self.npc.id}/").data
        return {c["name"] for c in data["conflict_clocks"] + data["alt_clocks"]}

    def _session_row(self, user):
        camp = self._as(user).get(f"/api/campaigns/{self.camp.id}/").data
        rows = (camp.get("active_session_detail") or {}).get("session_npcs_with_clocks", [])
        return next((r for r in rows if r["id"] == self.npc.id), None)

    def test_picked_player_sees_clock_without_a_session_reveal(self):
        self.assertEqual(self._npc_clock_names(self.p1), {"For P1"})
        self.assertEqual(self._npc_clock_names(self.p2), {"Alt P2"})
        self.assertEqual(self._npc_clock_names(self.p3), set())

    def test_session_show_all_does_not_expose_picked_clocks(self):
        SessionNPCInvolvement.objects.create(
            session=self.session, npc=self.npc, show_clocks_to_players=True
        )
        self.assertEqual(self._npc_clock_names(self.p1), {"For P1", "Open"})
        self.assertEqual(self._npc_clock_names(self.p3), {"Open"})
        row = self._session_row(self.p3)
        names = {c["name"] for c in row["conflict_clocks"] + row["alt_clocks"]}
        self.assertEqual(names, {"Open"})

    def test_session_reveal_by_name_does_not_expose_a_picked_clock(self):
        SessionNPCInvolvement.objects.create(
            session=self.session, npc=self.npc, revealed_conflict_clock_names=["For P1"]
        )
        self.assertEqual(self._npc_clock_names(self.p3), set())

    def test_picked_clock_in_session_row_for_picked_player(self):
        SessionNPCInvolvement.objects.create(session=self.session, npc=self.npc)
        row = self._session_row(self.p1)
        self.assertIsNotNone(row)
        self.assertEqual([c["name"] for c in row["conflict_clocks"]], ["For P1"])
        self.assertIsNone(self._session_row(self.p3))

    def test_showcased_npc_filters_picked_clocks(self):
        shown = ShowcasedNPC.objects.create(
            campaign=self.camp, npc=self.npc, show_clocks_to_party=True
        )
        data = ShowcasedNPCSerializer(
            shown, context={"request": SimpleNamespace(user=self.p3)}
        ).data["npc"]
        self.assertEqual([c["name"] for c in data["conflict_clocks"]], ["Open"])
        self.assertEqual(data["alt_clocks"], [])

    def test_player_payload_does_not_list_who_was_picked(self):
        data = self._as(self.p1).get(f"/api/npcs/{self.npc.id}/").data
        self.assertNotIn("visible_to", data["conflict_clocks"][0])

    def test_see_off_hides_picked_clock_and_npc(self):
        self.npc.visible_to_players = False
        self.npc.save()
        self.assertEqual(self._as(self.p1).get(f"/api/npcs/{self.npc.id}/").status_code, 404)

    def test_gm_payload_keeps_picks(self):
        data = self._as(self.gm).get(f"/api/npcs/{self.npc.id}/").data
        self.assertEqual(data["conflict_clocks"][0]["visible_to"], [self.p1.id])

    def test_save_keeps_crew_picks_and_drops_players_outside_the_crew(self):
        clocks = [
            {
                "id": 1,
                "name": "For P1",
                "segments": 6,
                "filled": 1,
                "visible_to": [self.p1.id, self.p3.id],
            }
        ]
        r = self._as(self.gm).patch(
            f"/api/npcs/{self.npc.id}/", {"conflict_clocks": clocks}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.npc.refresh_from_db()
        self.assertEqual(self.npc.conflict_clocks[0]["visible_to"], [self.p1.id])

    def test_npc_with_no_crew_can_pick_any_campaign_player(self):
        self.npc.crew = None
        self.npc.save()
        clocks = [{"id": 1, "name": "Any", "segments": 4, "filled": 0, "visible_to": [self.p3.id]}]
        r = self._as(self.gm).patch(
            f"/api/npcs/{self.npc.id}/", {"conflict_clocks": clocks}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.npc.refresh_from_db()
        self.assertEqual(self.npc.conflict_clocks[0]["visible_to"], [self.p3.id])
