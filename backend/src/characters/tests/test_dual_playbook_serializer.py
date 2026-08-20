"""Serializer tests: optional secondary_playbook on Character."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from characters.models import Character, Heritage
from characters.serializers import CharacterSerializer
from characters.services.xp_allocation import apply_unlock_second_playbook


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

    def test_rejects_secondary_without_30_xp_spend(self):
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

    def test_accepts_distinct_primary_and_secondary_after_unlock(self):
        self.char.unallocated_xp = 30
        self.char.save(update_fields=["unallocated_xp"])
        apply_unlock_second_playbook(self.char, secondary_playbook="STAND")
        self.char.refresh_from_db()
        self.assertEqual(self.char.secondary_playbook, "STAND")
        serializer = CharacterSerializer(
            instance=self.char,
            data={"playbook": "HAMON", "secondary_playbook": "SPIN"},
            partial=True,
            context={"request": self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()
        self.assertEqual(updated.playbook, "HAMON")
        self.assertEqual(updated.secondary_playbook, "SPIN")

    def test_rejects_duplicate_playbooks(self):
        data = {
            "playbook": "HAMON",
            "secondary_playbook": "HAMON",
        }
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={"request": self._request()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("secondary_playbook", serializer.errors)

    def test_rejects_invalid_secondary_playbook(self):
        data = {
            "playbook": "HAMON",
            "secondary_playbook": "INVALID",
        }
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={"request": self._request()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("secondary_playbook", serializer.errors)

    def test_clears_secondary_playbook_with_null(self):
        self.char.secondary_playbook = "STAND"
        self.char.save(update_fields=["secondary_playbook"])
        serializer = CharacterSerializer(
            instance=self.char,
            data={"secondary_playbook": None},
            partial=True,
            context={"request": self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()
        self.assertIsNone(updated.secondary_playbook)
