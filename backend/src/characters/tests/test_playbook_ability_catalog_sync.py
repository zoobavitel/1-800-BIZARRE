"""Tests for SRD playbook ability catalog sync."""

from django.test import TestCase

from characters.models import HamonAbility, SpinAbility
from characters.services.playbook_ability_catalog_sync import sync_playbook_ability_catalog


class PlaybookAbilityCatalogSyncTests(TestCase):
    def test_sync_spin_adds_missing_foundations(self):
        SpinAbility.objects.all().delete()
        SpinAbility.objects.create(
            name="Golden Arc",
            spin_type="FOUNDATION",
            description="legacy",
            required_a_count=0,
        )
        self.assertEqual(SpinAbility.objects.filter(spin_type="FOUNDATION").count(), 1)

        stats = sync_playbook_ability_catalog()

        self.assertEqual(SpinAbility.objects.filter(spin_type="FOUNDATION").count(), 10)
        self.assertGreaterEqual(stats["spin_created"], 9)
        golden = SpinAbility.objects.get(name="Golden Arc")
        self.assertNotEqual(golden.description, "legacy")

    def test_sync_hamon_is_idempotent(self):
        sync_playbook_ability_catalog()
        count_before = HamonAbility.objects.count()
        stats = sync_playbook_ability_catalog()
        self.assertEqual(HamonAbility.objects.count(), count_before)
        self.assertEqual(stats["hamon_created"], 0)
