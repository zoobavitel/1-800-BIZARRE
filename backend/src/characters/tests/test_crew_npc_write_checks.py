"""Crew and NPC writes that only the campaign GM may make (S5)."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import NPC, Campaign, Character, Crew, Heritage

GM_ONLY_CREW_STATS = {
    "level": 2,
    "xp": 3,
    "coin": 4,
    "rep": 5,
    "hold": "weak",
    "turf": 2,
    "wanted_level": 1,
}


class CrewGmOnlyWriteTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="cw_gm", password="pw-cw-gm-1")
        self.player = User.objects.create_user(username="cw_player", password="pw-cw-player-1")
        self.staff = User.objects.create_user(username="cw_staff", password="pw-cw-staff-1", is_staff=True)
        heritage, _ = Heritage.objects.get_or_create(name="Human", defaults={"base_hp": 0, "description": ""})
        self.campaign = Campaign.objects.create(name="CW Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        self.crew = Crew.objects.create(name="CW Crew", campaign=self.campaign, hold="strong")
        self.pc = Character.objects.create(
            user=self.player, campaign=self.campaign, crew=self.crew, true_name="CW PC", heritage=heritage
        )
        self.client = APIClient()

    def _patch(self, user, body):
        self.client.force_authenticate(user)
        return self.client.patch(f"/api/crews/{self.crew.pk}/", body, format="json")

    # Delete

    def test_member_cannot_delete_the_crew(self):
        self.client.force_authenticate(self.player)
        response = self.client.delete(f"/api/crews/{self.crew.pk}/")
        self.assertEqual(response.status_code, 403, response.content)
        self.assertTrue(Crew.objects.filter(pk=self.crew.pk).exists())

    def test_gm_and_staff_can_delete_the_crew(self):
        self.client.force_authenticate(self.gm)
        self.assertEqual(self.client.delete(f"/api/crews/{self.crew.pk}/").status_code, 204)
        other = Crew.objects.create(name="CW Crew 2", campaign=self.campaign)
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.delete(f"/api/crews/{other.pk}/").status_code, 204)

    # Stats

    def test_member_cannot_change_any_gm_only_stat(self):
        for field, value in GM_ONLY_CREW_STATS.items():
            with self.subTest(field=field):
                before = getattr(Crew.objects.get(pk=self.crew.pk), field)
                response = self._patch(self.player, {field: value})
                self.assertEqual(response.status_code, 403, response.content)
                self.assertEqual(getattr(Crew.objects.get(pk=self.crew.pk), field), before)

    def test_member_can_edit_shared_fields(self):
        response = self._patch(self.player, {"name": "New name", "notes": "n", "description": "d"})
        self.assertEqual(response.status_code, 200, response.content)
        self.crew.refresh_from_db()
        self.assertEqual((self.crew.name, self.crew.notes, self.crew.description), ("New name", "n", "d"))

    def test_member_sheet_autosave_with_unchanged_stats_still_saves_notes(self):
        """The sheet's crew autosave always sends the stats too (CharacterSheet.jsx
        buildCrewPatchPayload). Unchanged stats must not block a notes edit."""
        body = {
            "rep": self.crew.rep, "turf": self.crew.turf, "level": self.crew.level,
            "wanted_level": self.crew.wanted_level, "coin": self.crew.coin,
            "hold": self.crew.hold, "description": "", "notes": "from the sheet",
            "upgrade_progress": {},
        }
        response = self._patch(self.player, body)
        self.assertEqual(response.status_code, 200, response.content)
        self.crew.refresh_from_db()
        self.assertEqual(self.crew.notes, "from the sheet")

    def test_member_sheet_autosave_with_a_changed_stat_is_refused(self):
        body = {"coin": self.crew.coin + 1, "notes": "sneaky"}
        response = self._patch(self.player, body)
        self.assertEqual(response.status_code, 403, response.content)
        self.crew.refresh_from_db()
        self.assertNotEqual(self.crew.notes, "sneaky")

    def test_gm_can_change_stats(self):
        response = self._patch(self.gm, dict(GM_ONLY_CREW_STATS))
        self.assertEqual(response.status_code, 200, response.content)
        self.crew.refresh_from_db()
        for field, value in GM_ONLY_CREW_STATS.items():
            self.assertEqual(getattr(self.crew, field), value, field)


class NpcCampaignGmOnlyTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="nw_gm", password="pw-nw-gm-1")
        self.player = User.objects.create_user(username="nw_player", password="pw-nw-player-1")
        self.stranger = User.objects.create_user(username="nw_stranger", password="pw-nw-stranger-1")
        self.staff = User.objects.create_user(username="nw_staff", password="pw-nw-staff-1", is_staff=True)
        self.campaign = Campaign.objects.create(name="NW Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        self.client = APIClient()

    def _create(self, user, campaign=None):
        self.client.force_authenticate(user)
        body = {"name": "NW NPC"}
        if campaign is not None:
            body["campaign"] = campaign.pk
        return self.client.post("/api/npcs/", body, format="json")

    def test_player_cannot_create_an_npc_in_the_campaign(self):
        self.assertEqual(self._create(self.player, self.campaign).status_code, 403)
        self.assertFalse(NPC.objects.filter(campaign=self.campaign).exists())

    def test_stranger_cannot_create_an_npc_in_the_campaign(self):
        self.assertEqual(self._create(self.stranger, self.campaign).status_code, 403)
        self.assertFalse(NPC.objects.filter(campaign=self.campaign).exists())

    def test_gm_and_staff_can_create_campaign_npcs(self):
        self.assertEqual(self._create(self.gm, self.campaign).status_code, 201)
        self.assertEqual(self._create(self.staff, self.campaign).status_code, 201)

    def test_anyone_can_create_an_npc_without_a_campaign(self):
        self.assertEqual(self._create(self.player).status_code, 201)

    def test_creator_cannot_move_their_npc_into_someone_elses_campaign(self):
        npc = NPC.objects.create(name="Loose", creator=self.stranger)
        self.client.force_authenticate(self.stranger)
        response = self.client.patch(f"/api/npcs/{npc.pk}/", {"campaign": self.campaign.pk}, format="json")
        self.assertEqual(response.status_code, 403, response.content)
        npc.refresh_from_db()
        self.assertIsNone(npc.campaign_id)

    def test_gm_can_move_their_npc_into_their_campaign(self):
        npc = NPC.objects.create(name="Loose", creator=self.gm)
        self.client.force_authenticate(self.gm)
        response = self.client.patch(f"/api/npcs/{npc.pk}/", {"campaign": self.campaign.pk}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        npc.refresh_from_db()
        self.assertEqual(npc.campaign_id, self.campaign.pk)
