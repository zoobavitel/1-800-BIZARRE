"""Inventory normalization and session loadout tests."""

import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, EquipmentItem, Session
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
        self.assertEqual(normalize_inventory_list(["", "Hat"]), [normalize_inventory_item("Hat")])

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
        self.character = Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            true_name="PC",
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
