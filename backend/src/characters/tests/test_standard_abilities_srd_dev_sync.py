"""Standard ability catalog matches SRD_DEV list (post-0108)."""

import json
from pathlib import Path

from django.test import TestCase

from characters.models import Ability


class StandardAbilitiesSrdDevSyncTests(TestCase):
    def test_catalog_matches_srd_dev_fixture(self):
        fixture_path = (
            Path(__file__).resolve().parents[1] / "fixtures" / "standard_abilities.json"
        )
        rows = json.loads(fixture_path.read_text())
        expected = {item["fields"]["name"] for item in rows}

        db_names = set(
            Ability.objects.filter(type="standard").values_list("name", flat=True)
        )
        self.assertEqual(db_names, expected)
        self.assertEqual(len(expected), 45)
        self.assertIn("Swan Song", expected)

    def test_retired_abilities_removed_from_catalog(self):
        retired = (
            "Spin-Boosted Blow",
            "Steady Barrage",
            "Battleborn",
            "Fortitude",
            "Rule of Cool",
        )
        for name in retired:
            self.assertFalse(Ability.objects.filter(name=name).exists())
        self.assertTrue(
            Ability.objects.filter(name="Swan Song", type="standard").exists()
        )
