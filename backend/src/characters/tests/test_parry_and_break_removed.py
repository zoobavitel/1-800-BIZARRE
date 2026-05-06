"""Parry and Break was retired; catalog and Stand rows must stay clean."""

from django.test import TestCase

from characters.models import Ability, StandAbility


class ParryAndBreakRemovedTests(TestCase):
    def test_no_parry_and_break_catalog_rows(self):
        self.assertFalse(
            Ability.objects.filter(name__iexact="Parry and Break").exists()
        )
        self.assertFalse(
            StandAbility.objects.filter(name__iexact="Parry and Break").exists()
        )
