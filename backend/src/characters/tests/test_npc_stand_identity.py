"""NPC Stand identity flavor field normalization."""
from django.test import TestCase

from characters.services.npc_stand_identity import (
    normalize_stand_consciousness,
    normalize_stand_forms,
    normalize_stand_identity_types,
    normalize_stand_type_custom,
)


class NormalizeNpcStandIdentityTest(TestCase):
    def test_types_filter_and_dedupe(self):
        self.assertEqual(
            normalize_stand_identity_types(
                ["FIGHTING", "fighting", "NOPE", "", "COLONY"]
            ),
            ["FIGHTING", "COLONY"],
        )

    def test_forms_keep_custom(self):
        self.assertEqual(
            normalize_stand_forms(["Humanoid", "Mist-form", "Humanoid", ""]),
            ["Humanoid", "Mist-form"],
        )

    def test_consciousness(self):
        self.assertEqual(normalize_stand_consciousness("c"), "C")
        self.assertEqual(normalize_stand_consciousness("Z"), "")
        self.assertEqual(normalize_stand_consciousness(None), "")

    def test_type_custom_trim(self):
        self.assertEqual(normalize_stand_type_custom("  Weather  "), "Weather")
