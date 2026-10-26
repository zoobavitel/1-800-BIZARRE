"""The SRD catalogs are read-only for players, and unused per-PC routes are gone.

Before this, every route below was a plain ModelViewSet with IsAuthenticated,
so any signed-in account could create, edit or delete rows. Deleting a
heritage nulls it on every PC; deleting a Hamon or Spin ability removes it
from every PC that has it.
"""

from django.contrib.auth.models import User
from django.db import models
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Ability,
    Claim,
    CrewPlaybook,
    CrewSpecialAbility,
    CrewUpgrade,
    HamonAbility,
    Heritage,
    SpinAbility,
    Vice,
)

# Routes the app reads. Writes stay possible for staff (data fixes).
CATALOGS = [
    ("heritages", Heritage),
    ("vices", Vice),
    ("abilities", Ability),
    ("hamon-abilities", HamonAbility),
    ("spin-abilities", SpinAbility),
    ("claims", Claim),
    ("crew-playbooks", CrewPlaybook),
    ("crew-special-abilities", CrewSpecialAbility),
    ("crew-upgrades", CrewUpgrade),
]

# Routes the app never calls. Stands and stand abilities are edited through
# the character body; the rest have no client at all.
REMOVED = ["stands", "stand-abilities", "stress-history", "chat-messages", "session-events"]


def make_row(model, label):
    """One saved row, filling only required non-text fields."""
    kwargs = {"name": f"{label} row"} if any(
        f.name == "name" for f in model._meta.concrete_fields
    ) else {}
    for field in model._meta.concrete_fields:
        if field.primary_key or field.name in kwargs:
            continue
        if field.has_default() or field.null or field.empty_strings_allowed:
            continue
        if isinstance(field, models.BooleanField):
            kwargs[field.name] = False
        elif isinstance(field, (models.IntegerField, models.FloatField, models.DecimalField)):
            kwargs[field.name] = 0
        else:
            raise AssertionError(f"make_row: no filler for {model.__name__}.{field.name}")
    return model.objects.create(**kwargs)


class CatalogWritesNeedStaffTests(TestCase):
    def setUp(self):
        self.player = User.objects.create_user(username="player", password="pw-player-1")
        self.staff = User.objects.create_user(
            username="staffer", password="pw-staff-1", is_staff=True
        )
        self.client = APIClient()

    def test_player_cannot_create_edit_or_delete_catalog_rows(self):
        self.client.force_authenticate(self.player)
        for route, model in CATALOGS:
            row = make_row(model, route)
            before = model.objects.filter(pk=row.pk).values().first()
            count = model.objects.count()

            with self.subTest(route=route, verb="POST"):
                created = self.client.post(f"/api/{route}/", {"name": "new"}, format="json")
                self.assertEqual(created.status_code, 403)
                self.assertEqual(model.objects.count(), count)

            with self.subTest(route=route, verb="PATCH"):
                edited = self.client.patch(
                    f"/api/{route}/{row.pk}/", {"name": "hacked"}, format="json"
                )
                self.assertEqual(edited.status_code, 403)

            with self.subTest(route=route, verb="DELETE"):
                deleted = self.client.delete(f"/api/{route}/{row.pk}/")
                self.assertEqual(deleted.status_code, 403)

            with self.subTest(route=route, verb="row unchanged"):
                self.assertEqual(model.objects.filter(pk=row.pk).values().first(), before)

    def test_player_can_still_read_catalogs(self):
        self.client.force_authenticate(self.player)
        for route, model in CATALOGS:
            with self.subTest(route=route):
                make_row(model, route)
                self.assertEqual(self.client.get(f"/api/{route}/").status_code, 200)

    def test_staff_can_still_edit_catalog_rows(self):
        self.client.force_authenticate(self.staff)
        for route, model in CATALOGS:
            with self.subTest(route=route):
                row = make_row(model, route)
                response = self.client.patch(
                    f"/api/{route}/{row.pk}/", {"name": f"{route} fixed"}, format="json"
                )
                self.assertEqual(response.status_code, 200, f"PATCH {route}")


class UnusedRoutesRemovedTests(TestCase):
    def test_unused_per_pc_routes_are_gone(self):
        user = User.objects.create_user(username="anyone", password="pw-anyone-1")
        client = APIClient()
        client.force_authenticate(user)
        for route in REMOVED:
            with self.subTest(route=route):
                self.assertEqual(client.get(f"/api/{route}/").status_code, 404)
                self.assertEqual(
                    client.post(f"/api/{route}/", {}, format="json").status_code, 404
                )
