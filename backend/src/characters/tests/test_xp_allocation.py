from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Ability, Character, Heritage, Stand
from characters.services.xp_allocation import (
    XPAllocationError,
    apply_gm_forced_stand_stat,
    apply_level_up,
    apply_minor_advance,
    apply_unlock_second_playbook,
    complete_pending_stand_a_reward,
    get_pending_stand_a_reward,
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

    def test_playbook_overflow_level_up_undo_restores_past_ten(self):
        self.character.xp_clocks = {
            **self.character.xp_clocks,
            "playbook": 14,
        }
        self.character.save()
        alloc = apply_level_up(
            self.character,
            xp_track="playbook",
            choice="stat",
            stand_stat="speed",
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["playbook"], 4)
        undo_allocation(self.character, alloc, user=self.user)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["playbook"], 14)

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

    def test_gm_forced_stand_stat_tops_up_playbook_xp(self):
        self.character.xp_clocks["playbook"] = 2
        self.character.save()
        alloc = apply_gm_forced_stand_stat(
            self.character,
            stand_stat="speed",
            xp_track="playbook",
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.speed, "C")
        self.assertEqual(self.character.xp_clocks["playbook"], 0)
        self.assertEqual(self.character.stand_coin_points_gained, 1)
        self.assertEqual(self.character.total_xp_spent, 10)
        self.assertTrue(alloc.metadata.get("gm_forced"))
        self.assertEqual(alloc.metadata.get("gm_forced_xp_granted"), 8)

    def test_gm_forced_b_to_a_defers_reward_for_player(self):
        self.character.xp_clocks["playbook"] = 0
        self.character.save()
        alloc = apply_gm_forced_stand_stat(
            self.character,
            stand_stat="power",
            xp_track="playbook",
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.power, "A")
        self.assertTrue(alloc.metadata.get("gm_forced"))
        self.assertTrue(alloc.metadata.get("reward_pending"))
        pending = get_pending_stand_a_reward(self.character)
        self.assertIsNotNone(pending)
        self.assertEqual(pending["allocation_id"], alloc.id)
        self.assertEqual(pending["stand_stat"], "power")

        completed = complete_pending_stand_a_reward(
            self.character,
            allocation_id=alloc.id,
            reward={
                "branch": "two_standard",
                "standard_ability_ids": [self.std_a.id, self.std_b.id],
            },
        )
        self.character.refresh_from_db()
        self.assertFalse(completed.metadata.get("reward_pending"))
        self.assertIsNone(get_pending_stand_a_reward(self.character))
        ids = set(self.character.standard_abilities.values_list("id", flat=True))
        self.assertIn(self.std_a.id, ids)
        self.assertIn(self.std_b.id, ids)

    def test_unlock_second_playbook_costs_30_from_pool(self):
        self.character.unallocated_xp = 30
        self.character.save(update_fields=["unallocated_xp"])
        alloc = apply_unlock_second_playbook(
            self.character, secondary_playbook="HAMON"
        )
        self.character.refresh_from_db()
        self.assertEqual(alloc.allocation_type, "UNLOCK_SECOND_PLAYBOOK")
        self.assertEqual(self.character.unallocated_xp, 0)
        self.assertEqual(self.character.secondary_playbook, "HAMON")
        undo_allocation(self.character, alloc)
        self.character.refresh_from_db()
        self.assertIsNone(self.character.secondary_playbook)
        self.assertEqual(self.character.unallocated_xp, 30)

    def test_unlock_second_playbook_from_playbook_overflow(self):
        clocks = dict(self.character.xp_clocks or {})
        clocks["playbook"] = 30
        self.character.xp_clocks = clocks
        self.character.unallocated_xp = 0
        self.character.save(update_fields=["xp_clocks", "unallocated_xp"])
        alloc = apply_unlock_second_playbook(
            self.character, secondary_playbook="SPIN"
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.secondary_playbook, "SPIN")
        self.assertEqual(int(self.character.xp_clocks.get("playbook", 0) or 0), 0)
        self.assertEqual(alloc.metadata.get("playbook_spent"), 30)
        undo_allocation(self.character, alloc)
        self.character.refresh_from_db()
        self.assertIsNone(self.character.secondary_playbook)
        self.assertEqual(int(self.character.xp_clocks.get("playbook", 0) or 0), 30)

    def test_unlock_second_playbook_combined_wallet(self):
        clocks = dict(self.character.xp_clocks or {})
        clocks["playbook"] = 10
        self.character.xp_clocks = clocks
        self.character.unallocated_xp = 20
        self.character.save(update_fields=["xp_clocks", "unallocated_xp"])
        alloc = apply_unlock_second_playbook(
            self.character, secondary_playbook="SPIN"
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.secondary_playbook, "SPIN")
        self.assertEqual(int(self.character.xp_clocks.get("playbook", 0) or 0), 0)
        self.assertEqual(self.character.unallocated_xp, 0)
        self.assertEqual(alloc.metadata.get("playbook_spent"), 10)
        self.assertEqual(alloc.metadata.get("pool_spent"), 20)

    def test_unlock_second_playbook_rejects_short_pool(self):
        self.character.unallocated_xp = 10
        self.character.save(update_fields=["unallocated_xp"])
        with self.assertRaises(XPAllocationError):
            apply_unlock_second_playbook(self.character, secondary_playbook="SPIN")

    def test_unlock_second_playbook_rejects_same_as_primary(self):
        self.character.playbook = "HAMON"
        self.character.unallocated_xp = 30
        self.character.save(update_fields=["playbook", "unallocated_xp"])
        with self.assertRaises(XPAllocationError):
            apply_unlock_second_playbook(self.character, secondary_playbook="HAMON")


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
        # Heritage track cap is 5; undo refunds with clamp (setUp starts at 10).
        self.assertEqual(self.character.xp_clocks["heritage"], 5)
        self.assertEqual(self.character.action_dots["hunt"], 2)

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

    def test_apply_level_up_heritage_api(self):
        self.character.xp_clocks = {
            **self.character.xp_clocks,
            "playbook": 10,
        }
        self.character.save(update_fields=["xp_clocks"])
        res = self.client.post(
            f"/api/characters/{self.character.id}/apply-level-up/",
            {"xp_track": "playbook", "choice": "heritage"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["playbook"], 0)
        self.assertEqual(self.character.heritage_points_gained, 1)

    def test_apply_level_up_playbook_ability_for_spin_primary(self):
        spin_char = Character.objects.create(
            user=self.user,
            true_name="Spin XP",
            heritage=self.heritage,
            playbook="SPIN",
            action_dots={"hunt": 1, "study": 1, "survey": 1, "tinker": 1, "finesse": 1, "prowl": 1, "skirmish": 1},
            stress=9,
            xp_clocks={
                "insight": 0,
                "prowess": 0,
                "resolve": 0,
                "heritage": 0,
                "playbook": 10,
            },
        )
        alloc = apply_level_up(
            spin_char,
            xp_track="playbook",
            choice="playbook_ability",
        )
        spin_char.refresh_from_db()
        self.assertEqual(alloc.allocation_type, "LEVEL_UP_PLAYBOOK_ABILITY")
        self.assertEqual(spin_char.xp_clocks["playbook"], 0)

    def test_apply_level_up_playbook_ability_undo(self):
        spin_char = Character.objects.create(
            user=self.user,
            true_name="Spin Undo",
            heritage=self.heritage,
            playbook="HAMON",
            action_dots={"hunt": 1, "study": 1, "survey": 1, "tinker": 1, "finesse": 1, "prowl": 1, "skirmish": 1},
            stress=9,
            xp_clocks={"playbook": 10},
        )
        alloc = apply_level_up(
            spin_char,
            xp_track="playbook",
            choice="playbook_ability",
        )
        undo_allocation(spin_char, alloc, user=self.user)
        spin_char.refresh_from_db()
        self.assertEqual(spin_char.xp_clocks["playbook"], 10)

    def test_spin_primary_cannot_take_stat_from_playbook_track(self):
        spin_char = Character.objects.create(
            user=self.user,
            true_name="Spin Stat Block",
            heritage=self.heritage,
            playbook="SPIN",
            action_dots={"hunt": 1},
            stress=9,
            xp_clocks={"playbook": 10},
        )
        with self.assertRaises(XPAllocationError):
            apply_level_up(
                spin_char,
                xp_track="playbook",
                choice="stat",
                stand_stat="power",
            )

    def test_buy_hp_from_pool_api(self):
        self.character.unallocated_xp = 5
        self.character.save(update_fields=["unallocated_xp"])
        res = self.client.post(
            f"/api/characters/{self.character.id}/buy-hp-with-xp/",
            {"from_pool": True},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.character.refresh_from_db()
        self.assertEqual(self.character.unallocated_xp, 0)
        self.assertEqual(self.character.bonus_hp_from_xp, 1)

    def test_unlock_second_playbook_api(self):
        self.character.unallocated_xp = 30
        self.character.save(update_fields=["unallocated_xp"])
        res = self.client.post(
            f"/api/characters/{self.character.id}/unlock-second-playbook/",
            {"secondary_playbook": "SPIN"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.character.refresh_from_db()
        self.assertEqual(self.character.secondary_playbook, "SPIN")
        self.assertEqual(self.character.unallocated_xp, 0)
        self.assertTrue(res.data.get("character", {}).get("secondary_playbook_unlocked"))

    def test_unlock_second_playbook_api_rejects_short_pool(self):
        self.character.unallocated_xp = 29
        self.character.save(update_fields=["unallocated_xp"])
        res = self.client.post(
            f"/api/characters/{self.character.id}/unlock-second-playbook/",
            {"secondary_playbook": "SPIN"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.character.refresh_from_db()
        self.assertIsNone(self.character.secondary_playbook)
        self.assertEqual(self.character.unallocated_xp, 29)
