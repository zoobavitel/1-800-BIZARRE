"""Staff get no special access on the site (user's rule, 2026-11-08).

Like D&D Beyond: a staff account is a normal user in the app. It can't
read or change other people's characters, campaigns, sessions, NPCs or
crews through the API. Support work happens in Django admin. SRD catalog
writes stay staff-only, because nobody else owns the catalog.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import NPC, Campaign, Character, Crew, Heritage, Session


def rows(response):
    return response.data["results"] if isinstance(response.data, dict) and "results" in response.data else response.data


class NoStaffPowersTests(TestCase):
    def setUp(self):
        self.heritage, _ = Heritage.objects.get_or_create(name="Human", defaults={"base_hp": 0, "description": ""})
        self.gm = User.objects.create_user(username="ns_gm", password="pw-ns-gm-1")
        self.player = User.objects.create_user(username="ns_player", password="pw-ns-player-1")
        self.staff = User.objects.create_user(username="ns_staff", password="pw-ns-staff-1", is_staff=True)
        self.campaign = Campaign.objects.create(name="Private Table", gm=self.gm)
        self.campaign.players.add(self.player)
        self.pc = Character.objects.create(
            user=self.player, campaign=self.campaign, true_name="Secret PC", heritage=self.heritage
        )
        self.solo = Character.objects.create(user=self.player, true_name="Solo PC", heritage=self.heritage)
        self.session = Session.objects.create(campaign=self.campaign, name="Night 1")
        self.npc = NPC.objects.create(name="Secret NPC", creator=self.gm, campaign=self.campaign)
        self.crew = Crew.objects.create(name="Secret Crew", campaign=self.campaign)
        self.client = APIClient()
        self.client.force_authenticate(self.staff)

    def test_staff_cannot_open_other_peoples_characters(self):
        for pc in (self.pc, self.solo):
            with self.subTest(pc=pc.true_name):
                self.assertEqual(self.client.get(f"/api/characters/{pc.id}/").status_code, 404)

    def test_staff_character_list_has_only_their_own(self):
        names = {r["true_name"] for r in rows(self.client.get("/api/characters/"))}
        self.assertNotIn("Secret PC", names)
        self.assertNotIn("Solo PC", names)

    def test_staff_cannot_open_other_campaigns_sessions_npcs_or_crews(self):
        for url in (
            f"/api/campaigns/{self.campaign.id}/",
            f"/api/sessions/{self.session.id}/",
            f"/api/npcs/{self.npc.id}/",
            f"/api/crews/{self.crew.id}/",
        ):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 404)

    def test_staff_lists_hide_other_peoples_campaigns_and_sessions(self):
        self.assertEqual(rows(self.client.get("/api/campaigns/")), [])
        self.assertEqual(rows(self.client.get("/api/sessions/")), [])

    def test_staff_cannot_edit_another_players_sheet(self):
        response = self.client.patch(f"/api/characters/{self.pc.id}/", {"true_name": "Hijacked"}, format="json")
        self.assertIn(response.status_code, (403, 404))
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.true_name, "Secret PC")

    def test_the_gm_and_owner_still_can(self):
        for user in (self.gm, self.player):
            with self.subTest(user=user.username):
                self.client.force_authenticate(user)
                self.assertEqual(self.client.get(f"/api/characters/{self.pc.id}/").status_code, 200)

    def test_srd_catalog_writes_stay_staff_only(self):
        response = self.client.post("/api/heritages/", {"name": "Staff Heritage", "base_hp": 0, "description": ""}, format="json")
        self.assertIn(response.status_code, (200, 201), getattr(response, "data", None))
        self.client.force_authenticate(self.gm)
        response = self.client.post("/api/heritages/", {"name": "GM Heritage", "base_hp": 0, "description": ""}, format="json")
        self.assertEqual(response.status_code, 403)


class DjangoAdminEquipmentTests(TestCase):
    """Support work moves to Django admin, so equipment is managed there."""

    def setUp(self):
        from characters.models import EquipmentItem

        self.admin = User.objects.create_superuser(username="ns_admin", password="pw-ns-admin-1", email="")
        self.item = EquipmentItem.objects.create(name="Admin Crowbar", scope="TEMPLATE")
        self.client.force_login(self.admin)

    def test_equipment_list_and_edit_pages_load(self):
        self.assertEqual(self.client.get("/admin/characters/equipmentitem/").status_code, 200)
        self.assertEqual(self.client.get(f"/admin/characters/equipmentitem/{self.item.id}/change/").status_code, 200)
        self.assertEqual(self.client.get("/admin/characters/equipmentitem/?q=Crowbar").status_code, 200)

    def test_campaign_access_is_read_only(self):
        self.assertEqual(self.client.get("/admin/characters/campaignequipmentaccess/").status_code, 200)
        self.assertEqual(self.client.get("/admin/characters/campaignequipmentaccess/add/").status_code, 403)
