from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Ability, Character, Heritage, Stand
from characters.services.xp_allocation import (
    apply_level_up,
    apply_minor_advance,
    list_allocations,
    redo_allocation,
    undo_allocation,
)


class XPAllocationServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="xpuser", password="pass")
        self.heritage = Heritage.objects.create(
            name="Human", base_hp=0, description="Test"
        )
        self.std_a = Ability.objects.create(
            name="Std A", type="standard", description="A"
        )
        self.std_b = Ability.objects.create(
            name="Std B", type="standard", description="B"
        )
        self.std_c = Ability.objects.create(
            name="Std C", type="standard", description="C"
        )
        self.character = Character.objects.create(
            user=self.user,
            true_name="XP Test",
            heritage=self.heritage,
            action_dots={
                "hunt": 2,
                "study": 1,
                "survey": 1,
                "tinker": 1,
                "finesse": 1,
                "prowl": 1,
                "skirmish": 0,
                "wreck": 0,
                "bizarre": 0,
                "command": 0,
                "consort": 0,
                "sway": 0,
            },
            stress=9,
            xp_clocks={
                "insight": 0,
                "prowess": 0,
                "resolve": 0,
                "heritage": 10,
                "playbook": 0,
            },
            total_xp_spent=0,
            stand_coin_points_gained=0,
            action_dice_gained=0,
        )
        Stand.objects.create(
            character=self.character,
            name="Test Stand",
            type="FIGHTING",
            form="Humanoid",
            consciousness_level="C",
            power="B",
            speed="D",
            range="D",
            durability="D",
            precision="D",
            development="F",
        )
        self.character.coin_stats = {
            "power": "B",
            "speed": "D",
            "range": "D",
            "durability": "D",
            "precision": "D",
            "development": "F",
        }
        self.character.save()

    def test_level_up_stat_from_heritage_track(self):
        alloc = apply_level_up(
            self.character,
            xp_track="heritage",
            choice="stat",
            stand_stat="speed",
        )
        self.character.refresh_from_db()
        self.assertEqual(alloc.xp_track, "heritage")
        self.assertEqual(self.character.xp_clocks["heritage"], 0)
        self.assertEqual(self.character.stand.speed, "C")
        self.assertEqual(self.character.total_xp_spent, 10)
        self.assertEqual(self.character.stand_coin_points_gained, 1)

    def test_minor_advance_from_heritage_refund_on_undo(self):
        alloc = apply_minor_advance(
            self.character, xp_track="heritage", action="HUNT"
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["heritage"], 5)
        self.assertEqual(self.character.action_dots["hunt"], 3)

        undo_allocation(self.character, alloc, user=self.user)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["heritage"], 5)
        self.assertEqual(self.character.action_dots["hunt"], 2)
        self.assertIsNotNone(alloc.undone_at)

    def test_redo_allocation_after_undo(self):
        alloc = apply_minor_advance(
            self.character, xp_track="heritage", action="HUNT"
        )
        self.character.refresh_from_db()
        undo_allocation(self.character, alloc, user=self.user)
        self.character.refresh_from_db()
        self.assertEqual(self.character.action_dots["hunt"], 2)

        redo_allocation(self.character, alloc, user=self.user)
        self.character.refresh_from_db()
        alloc.refresh_from_db()
        self.assertEqual(self.character.action_dots["hunt"], 3)
        self.assertIsNone(alloc.undone_at)

    def test_b_to_a_two_standard_reward(self):
        self.character.xp_clocks = {
            **self.character.xp_clocks,
            "playbook": 10,
        }
        self.character.save()
        alloc = apply_level_up(
            self.character,
            xp_track="playbook",
            choice="stat",
            stand_stat="power",
            reward={
                "branch": "two_standard",
                "standard_ability_ids": [self.std_a.id, self.std_b.id],
            },
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.power, "A")
        ids = set(self.character.standard_abilities.values_list("id", flat=True))
        self.assertIn(self.std_a.id, ids)
        self.assertIn(self.std_b.id, ids)

        undo_allocation(self.character, alloc, user=self.user)
        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.power, "B")
        self.assertEqual(self.character.xp_clocks["playbook"], 10)
        ids_after = set(
            self.character.standard_abilities.values_list("id", flat=True)
        )
        self.assertNotIn(self.std_a.id, ids_after)
        self.assertNotIn(self.std_b.id, ids_after)

    def test_b_to_a_custom2_plus_standard(self):
        self.character.xp_clocks["heritage"] = 10
        self.character.save()
        alloc = apply_level_up(
            self.character,
            xp_track="heritage",
            choice="stat",
            stand_stat="power",
            reward={
                "branch": "custom2plus1standard",
                "custom_name": "Ripple Trick",
                "custom_uses": ["Use one", "Use two"],
                "standard_ability_id": self.std_c.id,
            },
        )
        self.character.refresh_from_db()
        self.assertEqual(len(self.character.advancement_ability_grants), 1)
        self.assertIn(self.std_c.id, list(self.character.standard_abilities.values_list("id", flat=True)))

        undo_allocation(self.character, alloc, user=self.user)
        self.character.refresh_from_db()
        self.assertEqual(self.character.advancement_ability_grants, [])
        self.assertNotIn(
            self.std_c.id,
            list(self.character.standard_abilities.values_list("id", flat=True)),
        )

    def test_undo_preserves_gm_xp_granted_after_spend(self):
        """LEVEL ↩ must not wipe GM scorecard ticks added after a spend."""
        self.character.xp_clocks = {
            **self.character.xp_clocks,
            "playbook": 5,
        }
        self.character.save()
        alloc = apply_minor_advance(
            self.character, xp_track="playbook", action="HUNT"
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["playbook"], 0)

        # GM end-of-session grant lands after the spend.
        clocks = dict(self.character.xp_clocks or {})
        clocks["playbook"] = int(clocks.get("playbook", 0) or 0) + 3
        self.character.xp_clocks = clocks
        self.character.save(update_fields=["xp_clocks"])
        self.assertEqual(self.character.xp_clocks["playbook"], 3)

        undo_allocation(self.character, alloc, user=self.user)
        self.character.refresh_from_db()
        # Refund +5 on top of GM's 3 (not snapshot restore to 5, which would drop GM ticks).
        self.assertEqual(self.character.xp_clocks["playbook"], 8)
        self.assertEqual(self.character.action_dots.get("hunt"), 2)


class XPAllocationAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="apiuser", password="pass")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.heritage = Heritage.objects.create(
            name="Human", base_hp=0, description="Test"
        )
        self.character = Character.objects.create(
            user=self.user,
            true_name="API XP",
            heritage=self.heritage,
            action_dots={"hunt": 2, "study": 1, "survey": 1, "tinker": 1,
                         "finesse": 1, "prowl": 1, "skirmish": 0, "wreck": 0,
                         "bizarre": 0, "command": 0, "consort": 0, "sway": 0},
            stress=9,
            xp_clocks={"heritage": 10, "playbook": 0, "insight": 0,
                       "prowess": 0, "resolve": 0},
        )
        Stand.objects.create(
            character=self.character,
            name="S",
            type="FIGHTING",
            form="Humanoid",
            consciousness_level="C",
            power="D",
            speed="D",
            range="D",
            durability="D",
            precision="D",
            development="F",
        )
        self.character.coin_stats = {
            "power": "D",
            "speed": "D",
            "range": "D",
            "durability": "D",
            "precision": "D",
            "development": "F",
        }
        self.character.save()

    def test_apply_level_up_dots_api(self):
        url = f"/api/characters/{self.character.id}/apply-level-up/"
        res = self.client.post(
            url,
            {
                "xp_track": "heritage",
                "choice": "dots",
                "actions": ["HUNT", "STUDY"],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["heritage"], 0)
        self.assertEqual(self.character.action_dots["hunt"], 3)
        self.assertEqual(len(list_allocations(self.character)), 1)

    def test_undo_latest_allocation_api(self):
        self.client.post(
            f"/api/characters/{self.character.id}/apply-minor-advance/",
            {"xp_track": "heritage", "action": "HUNT"},
            format="json",
        )
        res = self.client.post(
            f"/api/characters/{self.character.id}/undo-latest-allocation/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["heritage"], 5)

    def test_redo_latest_allocation_api(self):
        self.client.post(
            f"/api/characters/{self.character.id}/apply-minor-advance/",
            {"xp_track": "heritage", "action": "HUNT"},
            format="json",
        )
        self.client.post(
            f"/api/characters/{self.character.id}/undo-latest-allocation/",
            {},
            format="json",
        )
        res = self.client.post(
            f"/api/characters/{self.character.id}/redo-latest-allocation/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.character.refresh_from_db()
        self.assertEqual(self.character.action_dots["hunt"], 3)
