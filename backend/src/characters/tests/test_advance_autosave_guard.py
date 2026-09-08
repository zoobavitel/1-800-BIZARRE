"""Guard generic sheet PATCH from reverting allocation-owned character state."""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Character, Heritage, Stand
from characters.services.xp_allocation import (
    apply_level_up,
    apply_minor_advance,
    undo_allocation,
)


def _make_stand_character(**kwargs):
    user = kwargs.pop("user", None)
    if user is None:
        user = User.objects.create_user(
            username=kwargs.pop("username", "guard_user"),
            password="x",
        )
    else:
        kwargs.pop("username", None)
    heritage, _ = Heritage.objects.get_or_create(
        name="Human", defaults={"base_hp": 0, "description": ""}
    )
    defaults = {
        "user": user,
        "true_name": "Guard Tester",
        "playbook": "STAND",
        "level": 1,
        "heritage": heritage,
        "action_dots": {
            "hunt": 1,
            "study": 1,
            "survey": 1,
            "tinker": 1,
            "finesse": 1,
            "prowl": 1,
            "skirmish": 1,
        },
        "stress": 9,
        "xp_clocks": {
            "insight": 0,
            "prowess": 0,
            "resolve": 0,
            "heritage": 0,
            "playbook": 10,
        },
        "unallocated_xp": 0,
        "total_xp_spent": 0,
        "stand_coin_points_gained": 0,
        "advancement_ability_grants": [],
        "coin_stats": {
            "power": "A",
            "speed": "F",
            "range": "F",
            "durability": "A",
            "precision": "D",
            "development": "F",
        },
    }
    defaults.update(kwargs)
    character = Character.objects.create(**defaults)
    Stand.objects.create(
        character=character,
        name="Guard Stand",
        type="FIGHTING",
        form="Humanoid",
        forms=["Humanoid"],
        consciousness_level="C",
        power="A",
        speed="F",
        range="F",
        durability="A",
        precision="D",
        development="F",
        armor=0,
    )
    character.coin_stats = dict(defaults["coin_stats"])
    character.save(update_fields=["coin_stats"])
    return character


class AdvanceAutosaveGuardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="guard_u", password="x")
        self.client.force_authenticate(user=self.user)
        self.character = _make_stand_character(user=self.user, username="guard_u2")

    def _patch(self, payload):
        return self.client.patch(
            f"/api/characters/{self.character.id}/",
            payload,
            format="json",
        )

    def test_stale_patch_after_allocation_cannot_revert_stand_grade(self):
        apply_level_up(
            self.character,
            xp_track="playbook",
            choice="stat",
            stand_stat="development",
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.development, "D")

        response = self._patch(
            {
                "stand": {"development": "F"},
                "coin_stats": {"development": "F"},
            }
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("rejected_fields", response.data)
        self.assertIn("stand", response.data["rejected_fields"])

        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.development, "D")

    def test_stale_patch_cannot_revert_total_xp_spent(self):
        apply_level_up(
            self.character,
            xp_track="playbook",
            choice="stat",
            stand_stat="development",
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.total_xp_spent, 10)

        response = self._patch({"total_xp_spent": 0})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("total_xp_spent", response.data.get("rejected_fields", {}))

        self.character.refresh_from_db()
        self.assertEqual(self.character.total_xp_spent, 10)

    def test_stale_patch_cannot_revert_action_dots_after_minor_advance(self):
        self.character.xp_clocks = {
            "insight": 0,
            "prowess": 5,
            "resolve": 0,
            "heritage": 0,
            "playbook": 0,
        }
        self.character.save(update_fields=["xp_clocks"])
        apply_minor_advance(
            self.character,
            xp_track="prowess",
            action="finesse",
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.action_dots.get("finesse"), 2)

        response = self._patch(
            {
                "action_dots": dict(self.character.action_dots, finesse=1),
                "total_xp_spent": 0,
                "action_dice_gained": 0,
            }
        )
        self.assertEqual(response.status_code, 200, response.data)
        rejected = response.data.get("rejected_fields", {})
        self.assertIn("action_dots", rejected)
        self.assertIn("total_xp_spent", rejected)
        self.assertIn("action_dice_gained", rejected)

        self.character.refresh_from_db()
        self.assertEqual(self.character.action_dots.get("finesse"), 2)
        self.assertEqual(self.character.total_xp_spent, 5)
        self.assertEqual(self.character.action_dice_gained, 1)

    def test_stale_patch_cannot_wipe_advancement_grants(self):
        apply_level_up(
            self.character,
            xp_track="playbook",
            choice="stat",
            stand_stat="development",
        )
        grant = [
            {
                "allocation_id": 99,
                "name": "Test Grant",
                "custom_ability_type": "single_with_2_uses",
                "uses": ["a", "b"],
            }
        ]
        Character.objects.filter(pk=self.character.pk).update(
            advancement_ability_grants=grant,
        )
        self.character.refresh_from_db()
        self.assertTrue(self.character.advancement_ability_grants)

        response = self._patch({"advancement_ability_grants": []})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn(
            "advancement_ability_grants",
            response.data.get("rejected_fields", {}),
        )

        self.character.refresh_from_db()
        self.assertTrue(self.character.advancement_ability_grants)

    def test_chargen_stand_patch_still_allowed_before_allocations(self):
        response = self._patch({"stand": {"development": "D"}})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotIn("rejected_fields", response.data)

        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.development, "D")

    def test_stale_put_after_allocation_cannot_revert_stand_grade(self):
        apply_level_up(
            self.character,
            xp_track="playbook",
            choice="stat",
            stand_stat="development",
        )
        self.character.refresh_from_db()

        response = self.client.put(
            f"/api/characters/{self.character.id}/",
            {
                "true_name": self.character.true_name,
                "stand": {"development": "F"},
                "coin_stats": {"development": "F"},
                "total_xp_spent": 0,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.development, "D")
        self.assertEqual(self.character.total_xp_spent, 10)

    def test_coin_stats_never_writes_stand_even_during_chargen(self):
        response = self.client.patch(
            f"/api/characters/{self.character.id}/",
            {"coin_stats": {"power": "B", "speed": "B"}},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("coin_stats", response.data.get("rejected_fields", {}))
        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.power, "A")
        self.assertEqual(self.character.stand.speed, "F")

    def test_gm_update_field_can_set_level_after_allocation(self):
        apply_level_up(
            self.character,
            xp_track="playbook",
            choice="stat",
            stand_stat="development",
        )
        gm = User.objects.create_user(username="gm_lvl", password="x", is_staff=True)
        self.client.force_authenticate(user=gm)
        response = self.client.patch(
            f"/api/characters/{self.character.id}/update-field/",
            {"field": "level", "value": 2},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.character.refresh_from_db()
        self.assertEqual(self.character.level, 2)

    def test_add_xp_endpoint_bypasses_sheet_guard(self):
        Character.objects.filter(pk=self.character.pk).update(
            xp_clocks={
                "insight": 0,
                "prowess": 0,
                "resolve": 0,
                "heritage": 0,
                "playbook": 0,
            }
        )
        response = self.client.post(
            f"/api/characters/{self.character.id}/add-xp/",
            {"track": "playbook", "amount": 1, "description": "test grant"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 1)

    def test_undo_allocation_still_works_with_guard(self):
        allocation = apply_level_up(
            self.character,
            xp_track="playbook",
            choice="stat",
            stand_stat="development",
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.development, "D")

        undo_allocation(self.character, allocation, user=self.user)
        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.development, "F")
        self.assertEqual(self.character.xp_clocks["playbook"], 10)

    def test_gm_force_stand_stat_bypasses_sheet_guard(self):
        self.character.xp_clocks = {"playbook": 10}
        self.character.save(update_fields=["xp_clocks"])
        gm = User.objects.create_user(username="gm_force", password="x", is_staff=True)
        self.client.force_authenticate(user=gm)

        response = self.client.post(
            f"/api/characters/{self.character.id}/gm-force-stand-stat/",
            {"stand_stat": "development", "xp_track": "playbook"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)

        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.development, "D")


class AdvanceAutosaveRaceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="race_u", password="x")
        self.character = _make_stand_character(user=self.user, username="race_u2")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_stale_patch_immediately_after_allocation_commit(self):
        apply_level_up(
            self.character,
            xp_track="playbook",
            choice="stat",
            stand_stat="development",
        )
        self.character.refresh_from_db()

        response = self.client.patch(
            f"/api/characters/{self.character.id}/",
            {
                "stand": {"development": "F"},
                "total_xp_spent": 0,
                "coin_stats": {"development": "F"},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("stand", response.data.get("rejected_fields", {}))
        self.assertIn("total_xp_spent", response.data.get("rejected_fields", {}))

        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.development, "D")
        self.assertEqual(self.character.total_xp_spent, 10)

    def test_rejected_fields_logged(self):
        apply_level_up(
            self.character,
            xp_track="playbook",
            choice="stat",
            stand_stat="development",
        )
        with patch(
            "characters.services.sheet_patch_guard.log_rejected_sheet_patch_fields"
        ) as log_mock:
            response = self.client.patch(
                f"/api/characters/{self.character.id}/",
                {"total_xp_spent": 0},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        log_mock.assert_called_once()
        rejected_arg = log_mock.call_args[0][1]
        self.assertIn("total_xp_spent", rejected_arg)
