"""Session roster: which NPCs and factions are In session.

Session lists never change an NPC's faction. Adding an NPC brings its faction
into the session but not the faction's other members. Removing a faction can
take its NPCs out too, or leave them in.
"""

from importlib import import_module

from django.apps import apps as global_apps
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    Faction,
    Heritage,
    NPC,
    Session,
    SessionNPCInvolvement,
)


class SessionRosterTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="sr_gm", password="pw-sr-gm-1")
        self.p1 = User.objects.create_user(username="sr_p1", password="pw-sr-p1-1")
        self.camp = Campaign.objects.create(name="SR Camp", gm=self.gm)
        self.camp.players.add(self.p1)
        heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        Character.objects.create(
            user=self.p1, campaign=self.camp, true_name="SR One", heritage=heritage
        )
        self.session = Session.objects.create(campaign=self.camp, name="SR S1")
        self.fac_a = Faction.objects.create(name="A", campaign=self.camp)
        self.fac_b = Faction.objects.create(name="B", campaign=self.camp)
        self.a1 = NPC.objects.create(name="A1", campaign=self.camp, faction=self.fac_a, creator=self.gm)
        self.a2 = NPC.objects.create(name="A2", campaign=self.camp, faction=self.fac_a, creator=self.gm)
        self.b1 = NPC.objects.create(name="B1", campaign=self.camp, faction=self.fac_b, creator=self.gm)
        self.loner = NPC.objects.create(name="Loner", campaign=self.camp, creator=self.gm)
        other = Campaign.objects.create(name="Other", gm=self.gm)
        self.other_faction = Faction.objects.create(name="Other F", campaign=other)
        self.client = APIClient()

    def _as(self, user):
        self.client.force_authenticate(user)
        return self.client

    def _set_npcs(self, *npcs):
        r = self._as(self.gm).patch(
            f"/api/sessions/{self.session.id}/",
            {"npc_involvements": [{"npc": n.id} for n in npcs]},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        return r

    def _post(self, action, user=None, **body):
        return self._as(user or self.gm).post(
            f"/api/sessions/{self.session.id}/{action}/", body, format="json"
        )

    def _session_factions(self):
        return set(self.session.factions_involved.values_list("id", flat=True))

    def _session_npcs(self):
        return set(self.session.npcs_involved.values_list("id", flat=True))

    def test_new_session_starts_empty(self):
        self.assertEqual(self._session_factions(), set())
        self.assertEqual(self._session_npcs(), set())

    def test_adding_npc_adds_its_faction_but_not_other_members(self):
        r = self._set_npcs(self.a1)
        self.assertEqual(self._session_factions(), {self.fac_a.id})
        self.assertEqual(self._session_npcs(), {self.a1.id})
        self.assertEqual(r.data["factions_involved"], [self.fac_a.id])

    def test_adding_npc_with_no_faction_adds_no_faction(self):
        self._set_npcs(self.loner)
        self.assertEqual(self._session_factions(), set())

    def test_npcs_involved_path_also_adds_the_faction(self):
        r = self._as(self.gm).patch(
            f"/api/sessions/{self.session.id}/", {"npcs_involved": [self.b1.id]}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._session_factions(), {self.fac_b.id})

    def test_saving_npc_settings_does_not_bring_back_a_removed_faction(self):
        self._set_npcs(self.a1)
        self.assertEqual(self._post("remove-faction", faction=self.fac_a.id).status_code, 200)
        self._set_npcs(self.a1)
        self.assertEqual(self._session_factions(), set())

    def test_add_faction_changes_only_the_session(self):
        r = self._post("add-faction", faction=self.fac_b.id)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._session_factions(), {self.fac_b.id})
        self.assertEqual(self._session_npcs(), set())
        self.b1.refresh_from_db()
        self.assertEqual(self.b1.faction_id, self.fac_b.id)

    def test_add_faction_from_another_campaign_is_rejected(self):
        r = self._post("add-faction", faction=self.other_faction.id)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self._session_factions(), set())

    def test_remove_faction_only_keeps_its_npcs_in_session(self):
        self._set_npcs(self.a1, self.b1)
        r = self._post("remove-faction", faction=self.fac_a.id, remove_npcs=False)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._session_factions(), {self.fac_b.id})
        self.assertEqual(self._session_npcs(), {self.a1.id, self.b1.id})

    def test_remove_faction_and_npcs_takes_only_that_factions_npcs(self):
        self._set_npcs(self.a1, self.b1, self.loner)
        r = self._post("remove-faction", faction=self.fac_a.id, remove_npcs=True)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._session_factions(), {self.fac_b.id})
        self.assertEqual(self._session_npcs(), {self.b1.id, self.loner.id})

    def test_session_changes_never_change_npc_faction(self):
        self._set_npcs(self.a1)
        self._post("remove-faction", faction=self.fac_a.id, remove_npcs=True)
        self.a1.refresh_from_db()
        self.assertEqual(self.a1.faction_id, self.fac_a.id)

    def test_removing_from_one_session_leaves_another_alone(self):
        second = Session.objects.create(campaign=self.camp, name="SR S2")
        second.factions_involved.add(self.fac_a)
        SessionNPCInvolvement.objects.create(session=second, npc=self.a1)
        self._set_npcs(self.a1)
        self._post("remove-faction", faction=self.fac_a.id, remove_npcs=True)
        self.assertTrue(second.factions_involved.filter(id=self.fac_a.id).exists())
        self.assertTrue(second.npcs_involved.filter(id=self.a1.id).exists())

    def test_players_cannot_change_session_factions(self):
        self.assertEqual(self._post("add-faction", user=self.p1, faction=self.fac_a.id).status_code, 403)
        self.assertEqual(self._post("remove-faction", user=self.p1, faction=self.fac_a.id).status_code, 403)

    def test_factions_involved_cannot_be_written_through_patch(self):
        r = self._as(self.gm).patch(
            f"/api/sessions/{self.session.id}/",
            {"factions_involved": [self.other_faction.id]},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._session_factions(), set())

    def test_players_do_not_receive_the_gm_faction_list(self):
        self.session.factions_involved.add(self.fac_a)
        for url in (f"/api/sessions/{self.session.id}/", f"/api/sessions/?campaign={self.camp.id}"):
            data = self._as(self.p1).get(url).data
            rows = data if isinstance(data, list) else data.get("results", [data])
            for row in rows:
                self.assertNotIn("factions_involved", row)

    def test_gm_receives_the_list_on_session_detail(self):
        self.session.factions_involved.add(self.fac_a)
        data = self._as(self.gm).get(f"/api/sessions/{self.session.id}/").data
        self.assertEqual(data["factions_involved"], [self.fac_a.id])

    def test_backfill_puts_existing_npc_factions_in_their_sessions(self):
        SessionNPCInvolvement.objects.create(session=self.session, npc=self.a1)
        SessionNPCInvolvement.objects.create(session=self.session, npc=self.loner)
        migration = import_module("characters.migrations.0140_backfill_session_factions")
        migration.backfill_session_factions(global_apps, None)
        self.assertEqual(self._session_factions(), {self.fac_a.id})
