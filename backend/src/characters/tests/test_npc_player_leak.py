"""Players must not receive NPC data the GM has not revealed (story: NPC hidden data leak)."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    Faction,
    NPC,
    Session,
    SessionNPCInvolvement,
    ShowcasedNPC,
)

STATS = {
    "POWER": "A",
    "SPEED": "B",
    "DURABILITY": "C",
    "PRECISION": "B",
    "RANGE": "D",
    "POTENTIAL": "B",
}
OLD_TEXT_FIELDS = ("secret", "rumour", "weakness", "need", "desire", "passion")


class NpcPlayerLeakTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user("leak_gm", "leak_gm@test.com", "pw")
        self.player = User.objects.create_user("leak_pl", "leak_pl@test.com", "pw")
        self.creator = User.objects.create_user("leak_cr", "leak_cr@test.com", "pw")
        self.campaign = Campaign.objects.create(name="Leak", gm=self.gm)
        self.campaign.players.add(self.player, self.creator)
        Character.objects.create(true_name="PC", user=self.player, campaign=self.campaign)
        self.session = Session.objects.create(campaign=self.campaign, name="S1")
        self.campaign.active_session = self.session
        self.campaign.save(update_fields=["active_session"])
        self.faction = Faction.objects.create(
            name="Passione", campaign=self.campaign, visible_to_players=True
        )
        self.npc = NPC.objects.create(
            name="Diavolo",
            campaign=self.campaign,
            creator=self.gm,
            faction=self.faction,
            visible_to_players=True,
            secret="is Doppio",
            rumour="boss of Passione",
            weakness="his daughter",
            need="anonymity",
            desire="control",
            passion="the past",
            relationships={"Doppio": "self"},
            stand_coin_stats=STATS,
            vulnerability_clock_current=3,
            conflict_clocks=[{"name": "Erase time", "segments": 6, "filled": 2}],
            alt_clocks=[{"name": "Expose user", "segments": 8, "filled": 1}],
            faction_status={"Speedwagon": -2},
            players_see={"faction_membership": False},
        )
        self.url = f"/api/npcs/{self.npc.id}/"
        self.client = APIClient()

    def _get(self, user, url=None):
        self.client.force_authenticate(user=user)
        res = self.client.get(url or self.url)
        self.assertEqual(res.status_code, 200, res.content)
        return res.json()

    def _campaign_detail(self, user):
        return self._get(user, f"/api/campaigns/{self.campaign.id}/")

    # --- old narrative fields ---

    def test_player_never_gets_old_narrative_fields(self):
        data = self._get(self.player)
        for field in OLD_TEXT_FIELDS:
            self.assertEqual(data.get(field, ""), "", field)
        self.assertEqual(data.get("relationships", {}), {})

    def test_gm_keeps_old_narrative_fields(self):
        data = self._get(self.gm)
        self.assertEqual(data["secret"], "is Doppio")
        self.assertEqual(data["relationships"], {"Doppio": "self"})

    # --- clocks and stand coin follow the current session's reveals ---

    def test_player_gets_no_clocks_or_stand_coin_without_session_reveal(self):
        data = self._get(self.player)
        self.assertEqual(data["stand_coin_stats"], {})
        self.assertEqual(data["conflict_clocks"], [])
        self.assertEqual(data["alt_clocks"], [])
        self.assertIsNone(data["vulnerability_clock_current"])
        self.assertIsNone(data["vulnerability_clock_max"])

    def test_player_gets_clocks_and_stand_coin_revealed_in_current_session(self):
        SessionNPCInvolvement.objects.create(
            session=self.session,
            npc=self.npc,
            show_clocks_to_players=True,
            show_stand_coin_to_players=True,
        )
        data = self._get(self.player)
        self.assertEqual(data["stand_coin_stats"], STATS)
        self.assertEqual([c["name"] for c in data["conflict_clocks"]], ["Erase time"])
        self.assertEqual([c["name"] for c in data["alt_clocks"]], ["Expose user"])
        self.assertEqual(data["vulnerability_clock_current"], 3)

    def test_player_gets_only_named_clock_reveals(self):
        SessionNPCInvolvement.objects.create(
            session=self.session,
            npc=self.npc,
            show_clocks_to_players=False,
            revealed_alt_clock_names=["Expose user"],
            show_stand_coin_to_players=True,
            revealed_stand_coin_stats=["POWER"],
        )
        data = self._get(self.player)
        self.assertEqual(data["conflict_clocks"], [])
        self.assertEqual([c["name"] for c in data["alt_clocks"]], ["Expose user"])
        self.assertEqual(data["stand_coin_stats"], {"POWER": "A"})
        self.assertIsNone(data["vulnerability_clock_current"])

    def test_reveal_in_old_session_does_not_count(self):
        old = Session.objects.create(campaign=self.campaign, name="S0")
        SessionNPCInvolvement.objects.create(
            session=old, npc=self.npc, show_clocks_to_players=True
        )
        data = self._get(self.player)
        self.assertEqual(data["conflict_clocks"], [])

    def test_gm_keeps_clocks_and_stand_coin(self):
        data = self._get(self.gm)
        self.assertEqual(data["stand_coin_stats"], STATS)
        self.assertEqual(len(data["conflict_clocks"]), 1)
        self.assertEqual(data["vulnerability_clock_current"], 3)

    def test_player_faction_status_follows_faction_membership(self):
        self.assertEqual(self._get(self.player)["faction_status"], {})
        self.npc.players_see = {}
        self.npc.save(update_fields=["players_see"])
        self.assertEqual(self._get(self.player)["faction_status"], {"Speedwagon": -2})

    # --- creator who is not the GM ---

    def test_creator_gets_full_npc(self):
        mine = NPC.objects.create(
            name="Mine",
            campaign=self.campaign,
            creator=self.creator,
            visible_to_players=True,
            notes="creator notes",
            secret="creator secret",
            stand_coin_stats=STATS,
            players_see={"notes": False},
        )
        data = self._get(self.creator, f"/api/npcs/{mine.id}/")
        self.assertEqual(data["notes"], "creator notes")
        self.assertEqual(data["secret"], "creator secret")
        self.assertEqual(data["stand_coin_stats"], STATS)

    def test_creator_autosave_keeps_hidden_section(self):
        mine = NPC.objects.create(
            name="Mine",
            campaign=self.campaign,
            creator=self.creator,
            visible_to_players=True,
            notes="creator notes",
            players_see={"notes": False},
        )
        url = f"/api/npcs/{mine.id}/"
        payload = self._get(self.creator, url)
        payload["name"] = "Mine renamed"
        for key in ("image",):
            payload.pop(key, None)
        res = self.client.put(url, payload, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        mine.refresh_from_db()
        self.assertEqual(mine.name, "Mine renamed")
        self.assertEqual(mine.notes, "creator notes")

    # --- session cards and heal list ---

    def test_see_off_npc_absent_from_player_session_rows_and_heal_list(self):
        SessionNPCInvolvement.objects.create(
            session=self.session, npc=self.npc, show_clocks_to_players=True
        )
        self.npc.visible_to_players = False
        self.npc.save(update_fields=["visible_to_players"])
        detail = self._campaign_detail(self.player)["active_session_detail"]
        self.assertEqual(detail["session_npcs_with_clocks"], [])
        self.assertEqual(detail["session_npc_heal_roster"], [])
        gm_detail = self._campaign_detail(self.gm)["active_session_detail"]
        self.assertEqual(len(gm_detail["session_npcs_with_clocks"]), 1)
        self.assertEqual(len(gm_detail["session_npc_heal_roster"]), 1)

    # --- legacy showcased NPCs ---

    def test_showcase_of_see_off_npc_hidden_from_player(self):
        ShowcasedNPC.objects.create(campaign=self.campaign, npc=self.npc)
        self.npc.visible_to_players = False
        self.npc.save(update_fields=["visible_to_players"])
        self.assertEqual(self._campaign_detail(self.player)["showcased_npcs"], [])
        self.assertEqual(len(self._campaign_detail(self.gm)["showcased_npcs"]), 1)

    def test_showcase_hides_stand_name_when_identity_hidden(self):
        ShowcasedNPC.objects.create(campaign=self.campaign, npc=self.npc)
        self.npc.stand_name = "King Crimson"
        self.npc.players_see = {"stand_identity": False}
        self.npc.save(update_fields=["stand_name", "players_see"])
        rows = self._campaign_detail(self.player)["showcased_npcs"]
        self.assertEqual(rows[0]["npc"]["stand_name"], "")
        gm_rows = self._campaign_detail(self.gm)["showcased_npcs"]
        self.assertEqual(gm_rows[0]["npc"]["stand_name"], "King Crimson")

    # --- NPC-bound progress clocks ---

    def test_visible_clock_on_see_off_npc_hidden_from_player(self):
        from characters.models import ProgressClock

        ProgressClock.objects.create(
            name="Boss plan",
            campaign=self.campaign,
            npc=self.npc,
            created_by=self.gm,
            visible_to_players=True,
            max_segments=6,
        )
        names = lambda rows: {c["name"] for c in rows}
        self.assertIn("Boss plan", names(self._campaign_detail(self.player)["progress_clocks"]))
        self.npc.visible_to_players = False
        self.npc.save(update_fields=["visible_to_players"])
        self.assertNotIn(
            "Boss plan", names(self._campaign_detail(self.player)["progress_clocks"])
        )
        listed = self._get(
            self.player, f"/api/progress-clocks/?campaign={self.campaign.id}"
        )
        rows = listed["results"] if isinstance(listed, dict) else listed
        self.assertNotIn("Boss plan", names(rows))
        self.assertIn("Boss plan", names(self._campaign_detail(self.gm)["progress_clocks"]))
