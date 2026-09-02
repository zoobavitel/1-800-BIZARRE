"""Inventory normalization and session loadout tests."""

import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    CampaignEquipmentAccess,
    Character,
    EquipmentItem,
    Session,
)
from characters.services.inventory import normalize_inventory_list, normalize_inventory_item
from characters.services.loadout import (
    compute_load_used,
    load_cap_for_band,
    merge_loadout_map,
    normalize_loadout_entry,
)


class InventoryNormalizeTests(TestCase):
    def test_string_item_normalized(self):
        row = normalize_inventory_item("Knife")
        self.assertEqual(row["name"], "Knife")
        self.assertEqual(row["load"], 1)
        self.assertTrue(row["id"])

    def test_empty_string_skipped(self):
        self.assertIsNone(normalize_inventory_item(""))
        rows = normalize_inventory_list(["", "Hat"])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["name"], "Hat")

    def test_structured_roundtrip(self):
        raw = {
            "id": "abc",
            "name": "Pistol",
            "detail": "Q2",
            "category": "weapons",
            "load": 1,
            "quality": 2,
            "coin_value": 5,
        }
        norm = normalize_inventory_item(raw)
        self.assertEqual(norm["catalog_id"], None)
        self.assertEqual(norm["quality"], 2)
        self.assertFalse(norm["is_armor"])

    def test_is_armor_preserved(self):
        norm = normalize_inventory_item(
            {"id": "x", "name": "Leather", "armor_kind": "standard"}
        )
        self.assertTrue(norm["is_armor"])
        self.assertEqual(norm["armor_kind"], "standard")
        self.assertEqual(norm["load"], 0)

    def test_heavy_armor_two_charges_field(self):
        norm = normalize_inventory_item(
            {"id": "y", "name": "Plate", "armor_kind": "heavy"}
        )
        self.assertEqual(norm["armor_kind"], "heavy")
        self.assertEqual(norm["load"], 0)

    def test_special_armor_keeps_load(self):
        norm = normalize_inventory_item(
            {
                "id": "z",
                "name": "Weird charm",
                "armor_kind": "special",
                "load": 1,
            }
        )
        self.assertEqual(norm["armor_kind"], "special")
        self.assertFalse(norm["is_armor"])
        self.assertEqual(norm["load"], 1)


class LoadoutMathTests(TestCase):
    def test_mule_caps(self):
        self.assertEqual(load_cap_for_band("normal", False), 5)
        self.assertEqual(load_cap_for_band("normal", True), 7)

    def test_compute_load_with_coin(self):
        inv = [
            {"id": "1", "name": "Gun", "load": 1, "category": "weapons"},
        ]
        used = compute_load_used(
            inventory=inv,
            carried_ids=["1"],
            carry_coin=True,
            coin_filled=2,
        )
        self.assertEqual(used, 3)


class InventoryPatchApiTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user("gm", password="pass")
        self.player = User.objects.create_user("player", password="pass")
        self.campaign = Campaign.objects.create(name="C", gm=self.gm)
        from characters.models import Heritage

        self.heritage = Heritage.objects.create(name="Human", base_hp=0)
        self.character = Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            true_name="PC",
            heritage=self.heritage,
            inventory=[],
        )
        self.session = Session.objects.create(
            campaign=self.campaign,
            name="S1",
            status="ACTIVE",
        )
        self.client = APIClient()

    def test_patch_inventory_structured(self):
        self.client.force_authenticate(self.player)
        payload = {
            "inventory": [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Knife",
                    "load": 1,
                    "quality": 0,
                    "category": "weapons",
                }
            ]
        }
        res = self.client.patch(
            f"/api/characters/{self.character.id}/",
            payload,
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.character.refresh_from_db()
        self.assertEqual(len(self.character.inventory), 1)
        self.assertEqual(self.character.inventory[0]["name"], "Knife")

    def test_player_can_patch_own_loadout(self):
        self.client.force_authenticate(self.player)
        res = self.client.patch(
            f"/api/sessions/{self.session.id}/",
            {
                "loadout_by_character": {
                    str(self.character.id): {
                        "band": "normal",
                        "carried_ids": [],
                        "carry_coin": False,
                    }
                }
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.session.refresh_from_db()
        entry = self.session.loadout_by_character[str(self.character.id)]
        self.assertEqual(entry["band"], "normal")

    def test_equipment_template_list(self):
        EquipmentItem.objects.create(
            name="Test Blade",
            category="weapons",
            scope="TEMPLATE",
        )
        self.client.force_authenticate(self.player)
        res = self.client.get(
            f"/api/equipment-items/?campaign={self.campaign.id}"
        )
        self.assertEqual(res.status_code, 200)
        names = [r["name"] for r in res.json()]
        self.assertIn("Test Blade", names)


class SrdEquipmentTemplateSyncTests(TestCase):
    def test_sync_upserts_canonical_names_and_loads(self):
        from characters.services.equipment_template_sync import (
            CANONICAL_SRD_EQUIPMENT_TEMPLATES,
            CANONICAL_TEMPLATE_NAMES,
            sync_srd_equipment_templates,
        )

        EquipmentItem.objects.create(
            name="Rusty Knife",
            category="weapons",
            scope="TEMPLATE",
            load_slots=1,
        )
        climbing = EquipmentItem.objects.filter(
            scope="TEMPLATE", name="Climbing Gear"
        ).first()
        if climbing:
            climbing.load_slots = 1
            climbing.description = "old"
            climbing.save(update_fields=["load_slots", "description"])
        else:
            EquipmentItem.objects.create(
                name="Climbing Gear",
                category="gear",
                scope="TEMPLATE",
                load_slots=1,
                description="old",
            )

        stats = sync_srd_equipment_templates(prune_obsolete=True)
        self.assertGreaterEqual(stats["deleted"], 1)

        templates = EquipmentItem.objects.filter(scope="TEMPLATE")
        self.assertEqual(templates.count(), len(CANONICAL_SRD_EQUIPMENT_TEMPLATES))
        self.assertEqual(
            set(templates.values_list("name", flat=True)),
            set(CANONICAL_TEMPLATE_NAMES),
        )
        self.assertFalse(templates.filter(name="Rusty Knife").exists())

        by_name = {t.name: t for t in templates}
        for row in CANONICAL_SRD_EQUIPMENT_TEMPLATES:
            hit = by_name[row["name"]]
            self.assertEqual(hit.load_slots, row["load_slots"], row["name"])
            self.assertEqual(hit.category, row["category"], row["name"])
            self.assertEqual(hit.quality, row["quality"], row["name"])

        self.assertEqual(by_name["Climbing Gear"].load_slots, 2)
        self.assertEqual(by_name["Demolition Tools"].load_slots, 2)
        self.assertEqual(by_name["A Large Weapon"].load_slots, 2)
        self.assertNotEqual(by_name["Climbing Gear"].description, "old")

    def test_sync_idempotent(self):
        from characters.services.equipment_template_sync import (
            sync_srd_equipment_templates,
        )

        sync_srd_equipment_templates(prune_obsolete=True)
        second = sync_srd_equipment_templates(prune_obsolete=True)
        self.assertEqual(second["created"], 0)
        self.assertEqual(second["deleted"], 0)
        self.assertEqual(
            second["updated"],
            EquipmentItem.objects.filter(scope="TEMPLATE").count(),
        )


class EquipmentCatalogPermissionTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user("eq_gm", password="pass")
        self.creator = User.objects.create_user("eq_creator", password="pass")
        self.other = User.objects.create_user("eq_other", password="pass")
        self.staff = User.objects.create_user(
            "eq_staff", password="pass", is_staff=True
        )
        self.campaign = Campaign.objects.create(name="EqCamp", gm=self.gm)
        self.client = APIClient()

    def test_creator_can_delete_own_site_item(self):
        item = EquipmentItem.objects.create(
            name="Creator Site Widget",
            category="gear",
            scope="SITE",
            created_by=self.creator,
        )
        self.client.force_authenticate(self.creator)
        res = self.client.delete(f"/api/equipment-items/{item.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(EquipmentItem.objects.filter(pk=item.id).exists())

    def test_non_creator_cannot_delete_site_item(self):
        item = EquipmentItem.objects.create(
            name="Locked Site Widget",
            category="gear",
            scope="SITE",
            created_by=self.creator,
        )
        self.client.force_authenticate(self.other)
        res = self.client.delete(f"/api/equipment-items/{item.id}/")
        self.assertEqual(res.status_code, 403)
        self.assertTrue(EquipmentItem.objects.filter(pk=item.id).exists())

    def test_staff_can_delete_site_item(self):
        item = EquipmentItem.objects.create(
            name="Staff Wipe",
            category="gear",
            scope="SITE",
            created_by=self.creator,
        )
        self.client.force_authenticate(self.staff)
        res = self.client.delete(f"/api/equipment-items/{item.id}/")
        self.assertEqual(res.status_code, 204)

    def test_gm_can_delete_campaign_item(self):
        item = EquipmentItem.objects.create(
            name="Camp Gear",
            category="gear",
            scope="CAMPAIGN",
            campaign=self.campaign,
            created_by=self.creator,
        )
        self.client.force_authenticate(self.gm)
        res = self.client.delete(f"/api/equipment-items/{item.id}/")
        self.assertEqual(res.status_code, 204)

    def test_non_staff_cannot_delete_template(self):
        item = EquipmentItem.objects.create(
            name="SRD Template Blade",
            category="weapons",
            scope="TEMPLATE",
            created_by=self.creator,
        )
        self.client.force_authenticate(self.creator)
        res = self.client.delete(f"/api/equipment-items/{item.id}/")
        self.assertEqual(res.status_code, 403)

    def test_from_kit_item_skips_duplicate_template_name(self):
        EquipmentItem.objects.create(
            name="Unique Template Hammer",
            category="tools",
            scope="TEMPLATE",
            load_slots=2,
        )
        self.client.force_authenticate(self.gm)
        res = self.client.post(
            "/api/equipment-items/from-kit-item/",
            {
                "campaign": self.campaign.id,
                "name": "Unique Template Hammer",
                "load": 2,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            EquipmentItem.objects.filter(name__iexact="Unique Template Hammer").count(),
            1,
        )

    def test_from_kit_item_skips_duplicate_campaign_name(self):
        first = EquipmentItem.objects.create(
            name="Weird Widget",
            category="gear",
            scope="CAMPAIGN",
            campaign=self.campaign,
            created_by=self.gm,
        )
        self.client.force_authenticate(self.gm)
        res = self.client.post(
            "/api/equipment-items/from-kit-item/",
            {
                "campaign": self.campaign.id,
                "name": "weird widget",
                "load": 1,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["id"], first.id)
        self.assertEqual(
            EquipmentItem.objects.filter(
                campaign=self.campaign, name__iexact="Weird Widget"
            ).count(),
            1,
        )

    def test_publish_to_site_skips_existing_site_name(self):
        site = EquipmentItem.objects.create(
            name="Published Gadget",
            category="gear",
            scope="SITE",
            created_by=self.gm,
        )
        camp = EquipmentItem.objects.create(
            name="Published Gadget",
            category="gear",
            scope="CAMPAIGN",
            campaign=self.campaign,
            created_by=self.gm,
        )
        self.client.force_authenticate(self.gm)
        res = self.client.post(
            f"/api/equipment-items/{camp.id}/publish-to-site/"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["id"], site.id)
        self.assertEqual(
            EquipmentItem.objects.filter(
                name__iexact="Published Gadget", scope="SITE"
            ).count(),
            1,
        )

    def test_from_kit_item_creates_unique_custom(self):
        self.client.force_authenticate(self.gm)
        res = self.client.post(
            "/api/equipment-items/from-kit-item/",
            {
                "campaign": self.campaign.id,
                "name": "Unique Custom Dobby",
                "load": 1,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["scope"], "CAMPAIGN")
        self.assertEqual(
            EquipmentItem.objects.filter(name__iexact="Unique Custom Dobby").count(),
            1,
        )

    def test_unscoped_list_hides_campaign_library(self):
        EquipmentItem.objects.create(
            name="Campaign Only Widget",
            category="gear",
            scope="CAMPAIGN",
            campaign=self.campaign,
            created_by=self.gm,
        )
        EquipmentItem.objects.create(
            name="Site Public Widget",
            category="gear",
            scope="SITE",
            created_by=self.gm,
        )
        self.client.force_authenticate(self.gm)
        res = self.client.get("/api/equipment-items/")
        self.assertEqual(res.status_code, 200)
        names = [row["name"] for row in res.json()]
        self.assertNotIn("Campaign Only Widget", names)
        self.assertIn("Site Public Widget", names)
        self.client.force_authenticate(self.staff)
        res = self.client.get("/api/equipment-items/")
        self.assertEqual(res.status_code, 200)
        names = [row["name"] for row in res.json()]
        self.assertNotIn("Campaign Only Widget", names)

    def test_available_for_campaign_site_is_opt_in(self):
        site = EquipmentItem.objects.create(
            name="Opt In Site Widget",
            category="gear",
            scope="SITE",
            created_by=self.gm,
        )
        EquipmentItem.objects.create(
            name="Campaign Picker Widget",
            category="gear",
            scope="CAMPAIGN",
            campaign=self.campaign,
            created_by=self.gm,
            available_when_adding=True,
        )
        self.client.force_authenticate(self.gm)
        url = (
            f"/api/equipment-items/?campaign={self.campaign.id}"
            "&available_for_campaign=1"
        )
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        names = [row["name"] for row in res.json()]
        self.assertNotIn("Opt In Site Widget", names)
        self.assertIn("Campaign Picker Widget", names)

        CampaignEquipmentAccess.objects.create(
            campaign=self.campaign, item=site, enabled=True
        )
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        names = [row["name"] for row in res.json()]
        self.assertIn("Opt In Site Widget", names)

    def test_other_campaign_library_not_in_this_campaign_picker(self):
        other = Campaign.objects.create(name="OtherEqCamp", gm=self.other)
        EquipmentItem.objects.create(
            name="Other Table Secret",
            category="gear",
            scope="CAMPAIGN",
            campaign=other,
            created_by=self.other,
            available_when_adding=True,
        )
        self.client.force_authenticate(self.gm)
        res = self.client.get(
            f"/api/equipment-items/?campaign={self.campaign.id}"
            "&available_for_campaign=1"
        )
        self.assertEqual(res.status_code, 200)
        names = [row["name"] for row in res.json()]
        self.assertNotIn("Other Table Secret", names)
