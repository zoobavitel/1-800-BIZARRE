"""Serializer tests: secondary_playbook is legacy-only (Plan A)."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from characters.models import Character, Heritage
from characters.serializers import CharacterSerializer
from characters.services.xp_allocation import (
    XPAllocationError,
    apply_unlock_second_playbook,
)


class DualPlaybookSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="dual_pb_user", password="x")
        self.factory = APIRequestFactory()
        self.heritage = Heritage.objects.create(name="Test Heritage", base_hp=0)
        self.char = Character.objects.create(
            user=self.user,
            true_name="Tester",
            heritage=self.heritage,
            playbook="HAMON",
            coin_stats={
                "power": "F",
                "speed": "F",
                "range": "F",
                "durability": "F",
                "precision": "F",
                "development": "F",
            },
            action_dots={},
            trauma=[],
            xp_clocks={},
            stress=0,
        )

    def _request(self):
        req = self.factory.patch("/api/characters/")
        req.user = self.user
        return req

    def test_secondary_playbook_null_by_default(self):
        serializer = CharacterSerializer(instance=self.char)
        self.assertIsNone(serializer.data.get("secondary_playbook"))

    def test_rejects_new_secondary_playbook_write(self):
        data = {
            "playbook": "HAMON",
            "secondary_playbook": "STAND",
        }
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={"request": self._request()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("secondary_playbook", serializer.errors)

    def test_unlock_second_playbook_raises(self):
        with self.assertRaises(XPAllocationError):
            apply_unlock_second_playbook(self.char, secondary_playbook="STAND")

    def test_echo_same_legacy_secondary_allowed(self):
        self.char.secondary_playbook = "STAND"
        self.char.save(update_fields=["secondary_playbook"])
        serializer = CharacterSerializer(
            instance=self.char,
            data={"playbook": "HAMON", "secondary_playbook": "STAND"},
            partial=True,
            context={"request": self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_rejects_changing_legacy_secondary(self):
        self.char.secondary_playbook = "STAND"
        self.char.save(update_fields=["secondary_playbook"])
        serializer = CharacterSerializer(
            instance=self.char,
            data={"secondary_playbook": "SPIN"},
            partial=True,
            context={"request": self._request()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("secondary_playbook", serializer.errors)

    def test_clears_secondary_playbook_with_null(self):
        """Null secondary is allowed in validate; sheet guard may strip the write."""
        self.char.secondary_playbook = "STAND"
        self.char.save(update_fields=["secondary_playbook"])
        serializer = CharacterSerializer(
            instance=self.char,
            data={"secondary_playbook": None},
            partial=True,
            context={"request": self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
