"""Equipment catalog scope rules hold on create and on edit (S7).

Before this, any signed-in user could create a TEMPLATE item (global, on in
every campaign by default). An item's creator could also edit its scope to
TEMPLATE or SITE, or move it into another GM's campaign.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, EquipmentItem


class EquipmentScopeTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="eq_gm", password="pw-eq-gm-1")
        self.other_gm = User.objects.create_user(username="eq_other_gm", password="pw-eq-other-1")
        self.player = User.objects.create_user(username="eq_player", password="pw-eq-player-1")
        self.staff = User.objects.create_user(username="eq_staff", password="pw-eq-staff-1", is_staff=True)
        self.campaign = Campaign.objects.create(name="Eq Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        self.other_campaign = Campaign.objects.create(name="Other Eq Camp", gm=self.other_gm)
        self.item = EquipmentItem.objects.create(
            name="GM item", scope="CAMPAIGN", campaign=self.campaign, created_by=self.gm
        )
        self.client = APIClient()

    def post(self, user, body):
        self.client.force_authenticate(user)
        return self.client.post("/api/equipment-items/", body, format="json")

    def patch(self, user, body):
        self.client.force_authenticate(user)
        return self.client.patch(f"/api/equipment-items/{self.item.id}/", body, format="json")

    def test_only_staff_create_template_items(self):
        for user in (self.player, self.gm):
            with self.subTest(user=user.username):
                response = self.post(user, {"name": "Global thing", "scope": "TEMPLATE"})
                self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        self.assertFalse(EquipmentItem.objects.filter(name="Global thing").exists())
        self.assertEqual(self.post(self.staff, {"name": "Global thing", "scope": "TEMPLATE"}).status_code, 201)

    def test_the_gm_still_creates_campaign_items(self):
        response = self.post(self.gm, {"name": "Local", "scope": "CAMPAIGN", "campaign": self.campaign.id})
        self.assertEqual(response.status_code, 201, getattr(response, "data", None))

    def test_the_creator_cannot_promote_an_item_to_template_or_site(self):
        for scope in ("TEMPLATE", "SITE"):
            with self.subTest(scope=scope):
                response = self.patch(self.gm, {"scope": scope})
                self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        self.item.refresh_from_db()
        self.assertEqual(self.item.scope, "CAMPAIGN")

    def test_the_creator_cannot_move_an_item_into_another_gms_campaign(self):
        response = self.patch(self.gm, {"campaign": self.other_campaign.id})
        self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        self.item.refresh_from_db()
        self.assertEqual(self.item.campaign_id, self.campaign.id)

    def test_the_gm_can_still_rename_their_item(self):
        self.assertEqual(self.patch(self.gm, {"name": "Renamed"}).status_code, 200)


class SiteCatalogAndKitItemTests(TestCase):
    """The user's rule (2026-10-29): a player's own items stay private to
    their character; a GM may add one to their own campaign; only admins put
    anything in the site-wide catalog."""

    def setUp(self):
        from characters.models import Character, Heritage

        self.gm = User.objects.create_user(username="pub_gm", password="pw-pub-gm-1")
        self.staff = User.objects.create_user(username="pub_staff", password="pw-pub-staff-1", is_staff=True)
        self.campaign = Campaign.objects.create(name="Pub Camp", gm=self.gm)
        heritage, _ = Heritage.objects.get_or_create(name="Human", defaults={"base_hp": 0, "description": ""})
        far_gm = User.objects.create_user(username="pub_far_gm", password="pw-pub-far-1")
        far_campaign = Campaign.objects.create(name="Far Pub Camp", gm=far_gm)
        self.far_pc = Character.objects.create(user=far_gm, campaign=far_campaign, true_name="Far PC", heritage=heritage)
        self.item = EquipmentItem.objects.create(
            name="Pub item unique", scope="CAMPAIGN", campaign=self.campaign, created_by=self.gm
        )
        self.client = APIClient()

    def publish(self, user):
        self.client.force_authenticate(user)
        return self.client.post(f"/api/equipment-items/{self.item.id}/publish-to-site/", {}, format="json")

    def test_a_gm_cannot_publish_to_the_site_catalog(self):
        response = self.publish(self.gm)
        self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        self.assertFalse(EquipmentItem.objects.filter(scope="SITE", name="Pub item unique").exists())

    def test_staff_can_publish_to_the_site_catalog(self):
        self.assertEqual(self.publish(self.staff).status_code, 201)

    def test_save_to_campaign_library_rejects_a_character_from_another_campaign(self):
        self.client.force_authenticate(self.gm)
        response = self.client.post(
            "/api/equipment-items/from-kit-item/",
            {"campaign": self.campaign.id, "name": "Kit thing unique", "source_character": self.far_pc.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400, getattr(response, "data", None))
        self.assertFalse(EquipmentItem.objects.filter(name="Kit thing unique").exists())
