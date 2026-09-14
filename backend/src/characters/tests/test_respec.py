"""Respec mode: fold from ledger, commit diffs, refund to unallocated_xp."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import (
    Ability,
    Character,
    CharacterXPAllocation,
    Heritage,
    Stand,
    Vice,
)
from characters.services.respec import (
    RespecError,
    commit_respec,
    diff_fold_vs_live,
    ensure_chargen_baseline,
    rebuild_from_allocations,
    verify_character_ledger,
)
from characters.services.xp_allocation import apply_level_up, apply_minor_advance


class RespecFoldTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="respec_u", password="x")
        self.heritage = Heritage.objects.create(name="Human", base_hp=0, description="")
        self.vice = Vice.objects.create(name="RespecVice", description="")
        self.character = Character.objects.create(
            user=self.user,
            true_name="Respec PC",
            heritage=self.heritage,
            vice=self.vice,
            playbook="STAND",
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
                "insight": 5,
                "prowess": 0,
                "resolve": 0,
                "heritage": 0,
                "playbook": 20,
            },
            total_xp_spent=0,
            stand_coin_points_gained=0,
            action_dice_gained=0,
            unallocated_xp=0,
        )
        Stand.objects.create(
            character=self.character,
            name="Respec Stand",
            type="FIGHTING",
            form="Humanoid",
            consciousness_level="C",
            power="D",
            speed="D",
            range="D",
            durability="D",
            precision="D",
            development="D",
        )
        self.character.coin_stats = {
            "power": "D",
            "speed": "D",
            "range": "D",
            "durability": "D",
            "precision": "D",
            "development": "D",
        }
        self.character.save()

    def test_fold_idempotence(self):
        apply_minor_advance(self.character, xp_track="insight", action="HUNT")
        self.character.xp_clocks = {**self.character.xp_clocks, "playbook": 10}
        self.character.save(update_fields=["xp_clocks"])
        apply_level_up(
            self.character,
            xp_track="playbook",
            choice="stat",
            stand_stat="power",
        )
        a = rebuild_from_allocations(self.character).to_dict()
        b = rebuild_from_allocations(self.character).to_dict()
        self.assertEqual(a["action_dots"], b["action_dots"])
        self.assertEqual(a["coin_stats"], b["coin_stats"])
        self.assertEqual(a["total_xp_spent"], b["total_xp_spent"])

    def test_fold_matches_live_after_spends(self):
        apply_minor_advance(self.character, xp_track="insight", action="HUNT")
        self.character.refresh_from_db()
        ok, diffs = verify_character_ledger(self.character)
        self.assertTrue(ok, diffs)
        self.assertEqual(diffs, {})

    def test_drop_stat_out_of_order_refunds_to_pool(self):
        self.character.xp_clocks = {
            **self.character.xp_clocks,
            "playbook": 20,
            "insight": 0,
        }
        self.character.save(update_fields=["xp_clocks"])
        a1 = apply_level_up(
            self.character, xp_track="playbook", choice="stat", stand_stat="power"
        )
        a2 = apply_level_up(
            self.character, xp_track="playbook", choice="stat", stand_stat="speed"
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.power, "C")
        self.assertEqual(self.character.stand.speed, "C")

        result = commit_respec(
            self.character,
            draft={"dropped_allocation_ids": [a1.id], "added": []},
            commit_token="tok-drop-power",
            user=self.user,
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.stand.power, "D")
        self.assertEqual(self.character.stand.speed, "C")
        self.assertEqual(self.character.unallocated_xp, 10)
        self.assertEqual(result["net_xp"], 10)
        a1.refresh_from_db()
        self.assertIsNotNone(a1.undone_at)
        self.assertTrue((a1.metadata or {}).get("reversal"))

    def test_respec_round_trip_empty_draft(self):
        apply_minor_advance(self.character, xp_track="insight", action="HUNT")
        self.character.refresh_from_db()
        before_dots = dict(self.character.action_dots)
        before_pool = int(self.character.unallocated_xp or 0)
        result = commit_respec(
            self.character,
            draft={"dropped_allocation_ids": [], "added": []},
            commit_token="tok-empty",
            user=self.user,
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.action_dots, before_dots)
        self.assertEqual(int(self.character.unallocated_xp or 0), before_pool)
        self.assertEqual(result["net_xp"], 0)

    def test_idempotent_commit_token(self):
        apply_minor_advance(self.character, xp_track="insight", action="HUNT")
        alloc = (
            CharacterXPAllocation.objects.filter(character=self.character)
            .order_by("-id")
            .first()
        )
        commit_respec(
            self.character,
            draft={"dropped_allocation_ids": [alloc.id], "added": []},
            commit_token="same-token",
            user=self.user,
        )
        self.character.refresh_from_db()
        pool_after = int(self.character.unallocated_xp or 0)
        result = commit_respec(
            self.character,
            draft={"dropped_allocation_ids": [alloc.id], "added": []},
            commit_token="same-token",
            user=self.user,
        )
        self.character.refresh_from_db()
        self.assertTrue(result["idempotent"])
        self.assertEqual(int(self.character.unallocated_xp or 0), pool_after)

    def test_ledger_block_when_mismatch(self):
        apply_minor_advance(self.character, xp_track="insight", action="HUNT")
        self.character.refresh_from_db()
        # Corrupt live dots without allocation change
        dots = dict(self.character.action_dots)
        dots["hunt"] = int(dots.get("hunt") or 0) + 1
        Character.objects.filter(pk=self.character.pk).update(action_dots=dots)
        self.character.refresh_from_db()
        ok, diffs = verify_character_ledger(self.character)
        self.assertFalse(ok)
        self.assertIn("action_dots", diffs)
        with self.assertRaises(RespecError):
            commit_respec(
                self.character,
                draft={"dropped_allocation_ids": [], "added": []},
                commit_token="blocked",
                user=self.user,
            )

    def test_refund_goes_to_unallocated_not_track(self):
        self.character.xp_clocks = {
            **self.character.xp_clocks,
            "playbook": 4,
        }
        self.character.save(update_fields=["xp_clocks"])
        # Spend via legacy marks by topping playbook then spending
        self.character.xp_clocks = {**self.character.xp_clocks, "playbook": 10}
        self.character.save(update_fields=["xp_clocks"])
        alloc = apply_level_up(
            self.character, xp_track="playbook", choice="stat", stand_stat="power"
        )
        self.character.refresh_from_db()
        clocks_before = dict(self.character.xp_clocks)
        commit_respec(
            self.character,
            draft={"dropped_allocation_ids": [alloc.id], "added": []},
            commit_token="tok-pool",
            user=self.user,
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.unallocated_xp, 10)
        # Track marks unchanged by respec refund
        self.assertEqual(
            int(self.character.xp_clocks.get("playbook") or 0),
            int(clocks_before.get("playbook") or 0),
        )

    def test_respec_commit_api(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        apply_minor_advance(self.character, xp_track="insight", action="HUNT")
        alloc = (
            CharacterXPAllocation.objects.filter(character=self.character)
            .order_by("-id")
            .first()
        )
        r = client.post(
            f"/api/characters/{self.character.id}/respec-commit/",
            {
                "commit_token": "api-tok-1",
                "draft": {"dropped_allocation_ids": [alloc.id], "added": []},
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertTrue(r.data.get("success"))
        self.character.refresh_from_db()
        self.assertEqual(self.character.unallocated_xp, 5)
        self.assertEqual(self.character.action_dots.get("hunt"), 2)

    def test_respec_status_api(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        ensure_chargen_baseline(self.character)
        r = client.get(f"/api/characters/{self.character.id}/respec-status/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertTrue(r.data.get("allowed"))

    def test_chargen_baseline_captured_on_first_spend(self):
        self.assertFalse(self.character.chargen_baseline)
        apply_minor_advance(self.character, xp_track="insight", action="HUNT")
        self.character.refresh_from_db()
        self.assertTrue(self.character.chargen_baseline)
        self.assertEqual(
            self.character.chargen_baseline.get("action_dots", {}).get("hunt"), 2
        )

    def test_post_chargen_patch_cannot_clear_xp_owned_spin_via_nf_drop(self):
        """Removing non-foundation playbook abilities post-chargen is rejected."""
        # Stand primary with no spin — skip if no spin abilities in DB
        from characters.models import SpinAbility

        foundation = SpinAbility.objects.filter(spin_type="FOUNDATION").first()
        technique = (
            SpinAbility.objects.exclude(spin_type="FOUNDATION").first()
        )
        if not foundation or not technique:
            self.skipTest("SpinAbility fixtures not loaded")

        self.character.playbook = "SPIN"
        self.character.save(update_fields=["playbook"])
        from characters.models import CharacterSpinAbility

        CharacterSpinAbility.objects.create(
            character=self.character,
            spin_ability=foundation,
            acquired_at_creation=True,
        )
        CharacterSpinAbility.objects.create(
            character=self.character,
            spin_ability=technique,
            acquired_at_creation=False,
        )
        # Create a dummy allocation so post-chargen
        CharacterXPAllocation.objects.create(
            character=self.character,
            allocation_type="LEVEL_UP_PLAYBOOK_ABILITY",
            xp_track="playbook",
            xp_cost=10,
            payload_before={},
            payload_after={},
            metadata={"picked": {"kind": "spin", "id": technique.id, "name": technique.name}},
        )
        self.character.total_xp_spent = 10
        self.character.save(update_fields=["total_xp_spent"])

        client = APIClient()
        client.force_authenticate(user=self.user)
        r = client.patch(
            f"/api/characters/{self.character.id}/",
            {"spin_ability_ids": [foundation.id]},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
