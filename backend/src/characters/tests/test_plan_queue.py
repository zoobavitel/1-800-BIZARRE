"""Plan B AdvancementPlanItem CRUD + payload validation."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Ability,
    AdvancementPlanItem,
    Character,
    CharacterXPAllocation,
    Heritage,
    Stand,
)
from characters.services.plan_queue import (
    PlanQueueError,
    create_plan_item,
    reorder_plan_items,
)


class PlanQueueServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("plan_queue_user", password="x")
        self.heritage = Heritage.objects.create(name="Human", base_hp=0)
        self.character = Character.objects.create(
            user=self.user,
            true_name="Plan Queue PC",
            heritage=self.heritage,
            playbook="STAND",
            action_dots={"hunt": 1, "study": 1},
            trauma=[],
            xp_clocks={},
            stress=0,
        )
        self.stand = Stand.objects.create(
            character=self.character,
            name="Test Stand",
            type="FIGHTING",
            form="Humanoid",
            consciousness_level="C",
            power="C",
            speed="D",
            range="F",
            durability="D",
            precision="F",
            development="F",
        )
        # End chargen so plan fire predicates match production.
        CharacterXPAllocation.objects.create(
            character=self.character,
            allocation_type="LEVEL_UP_STAT",
            xp_track="playbook",
            xp_cost=10,
            metadata={"seed": True},
        )

    def test_action_dot_create(self):
        item = create_plan_item(
            self.character,
            track="insight",
            kind="action_dot",
            payload={"action": "hunt"},
        )
        self.assertEqual(item.order, 1)
        self.assertEqual(item.payload["action"], "hunt")
        self.assertEqual(item.status, AdvancementPlanItem.STATUS_QUEUED)

    def test_action_dot_wrong_attribute_rejected(self):
        with self.assertRaises(PlanQueueError):
            create_plan_item(
                self.character,
                track="insight",
                kind="action_dot",
                payload={"action": "wreck"},
            )

    def test_coin_grade_queues_next_up(self):
        item = create_plan_item(
            self.character,
            track="playbook",
            kind="coin_grade",
            payload={"stat": "power"},
        )
        self.assertEqual(item.payload["from_grade"], "C")
        self.assertEqual(item.payload["to_grade"], "B")
        self.assertNotIn("a_grant", item.payload)

    def test_coin_grade_stacks_along_queue(self):
        """Second click on same stat chains from queued to_grade, not live grade."""
        self.stand.speed = "D"
        self.stand.save(update_fields=["speed"])
        first = create_plan_item(
            self.character,
            track="playbook",
            kind="coin_grade",
            payload={"stat": "speed"},
        )
        self.assertEqual(first.payload["from_grade"], "D")
        self.assertEqual(first.payload["to_grade"], "C")
        second = create_plan_item(
            self.character,
            track="playbook",
            kind="coin_grade",
            payload={"stat": "speed"},
        )
        self.assertEqual(second.payload["from_grade"], "C")
        self.assertEqual(second.payload["to_grade"], "B")
        third = create_plan_item(
            self.character,
            track="playbook",
            kind="coin_grade",
            payload={
                "stat": "speed",
                "a_grant": {
                    "branch": "two_standard",
                    "standard_ability_ids": [
                        Ability.objects.create(
                            name="Stack Std 1", type="standard", description="x"
                        ).id,
                        Ability.objects.create(
                            name="Stack Std 2", type="standard", description="y"
                        ).id,
                    ],
                },
            },
        )
        self.assertEqual(third.payload["from_grade"], "B")
        self.assertEqual(third.payload["to_grade"], "A")

    def test_coin_grade_b_to_a_requires_a_grant(self):
        self.stand.power = "B"
        self.stand.save(update_fields=["power"])
        with self.assertRaises(PlanQueueError) as ctx:
            create_plan_item(
                self.character,
                track="playbook",
                kind="coin_grade",
                payload={"stat": "power"},
            )
        self.assertIn("a_grant", ctx.exception.message)

        std = Ability.objects.create(
            name="Std A",
            type="standard",
            description="x",
        )
        std2 = Ability.objects.create(
            name="Std B",
            type="standard",
            description="y",
        )
        item = create_plan_item(
            self.character,
            track="playbook",
            kind="coin_grade",
            payload={
                "stat": "power",
                "a_grant": {
                    "branch": "two_standard",
                    "standard_ability_ids": [std.id, std2.id],
                },
            },
        )
        self.assertEqual(item.payload["to_grade"], "A")
        self.assertEqual(item.payload["a_grant_child_count"], 2)

    def test_coin_grade_a_ceiling_blocks_s(self):
        self.stand.power = "A"
        self.stand.save(update_fields=["power"])
        with self.assertRaises(PlanQueueError) as ctx:
            create_plan_item(
                self.character,
                track="playbook",
                kind="coin_grade",
                payload={"stat": "power"},
            )
        self.assertIn("A-rank", ctx.exception.message)

    def test_custom_ability_top_level_rejected(self):
        with self.assertRaises(PlanQueueError):
            create_plan_item(
                self.character,
                track="playbook",
                kind="ability",
                payload={"ability_id": 1, "ability_source": "custom"},
            )

    def test_reorder(self):
        a = create_plan_item(
            self.character,
            track="insight",
            kind="action_dot",
            payload={"action": "hunt"},
        )
        b = create_plan_item(
            self.character,
            track="insight",
            kind="action_dot",
            payload={"action": "study"},
        )
        reorder_plan_items(self.character, "insight", [b.id, a.id])
        a.refresh_from_db()
        b.refresh_from_db()
        self.assertEqual(b.order, 1)
        self.assertEqual(a.order, 2)


class PlanQueueAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("plan_api_user", password="x")
        self.heritage = Heritage.objects.create(name="Human", base_hp=0)
        self.character = Character.objects.create(
            user=self.user,
            true_name="Plan API PC",
            heritage=self.heritage,
            playbook="STAND",
            action_dots={"hunt": 1},
            trauma=[],
            xp_clocks={},
            stress=0,
        )
        Stand.objects.create(
            character=self.character,
            name="API Stand",
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
        CharacterXPAllocation.objects.create(
            character=self.character,
            allocation_type="LEVEL_UP_STAT",
            xp_track="playbook",
            xp_cost=10,
            metadata={"seed": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_post_and_list(self):
        url = f"/api/characters/{self.character.id}/advancement-plan/"
        resp = self.client.post(
            url,
            {"track": "insight", "kind": "action_dot", "payload": {"action": "hunt"}},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data["item"]["kind"], "action_dot")

        listed = self.client.get(url)
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.data["items"]), 1)

    def test_character_serializer_includes_plan(self):
        create_plan_item(
            self.character,
            track="insight",
            kind="action_dot",
            payload={"action": "hunt"},
        )
        resp = self.client.get(f"/api/characters/{self.character.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data.get("advancement_plan") or []), 1)


class PlanWalkTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("plan_walk_user", password="x")
        self.heritage = Heritage.objects.create(name="Human", base_hp=0)
        self.character = Character.objects.create(
            user=self.user,
            true_name="Plan Walk PC",
            heritage=self.heritage,
            playbook="STAND",
            action_dots={"hunt": 1, "study": 1, "survey": 0, "tinker": 0},
            trauma=[],
            xp_clocks={},
            stress=0,
        )
        self.stand = Stand.objects.create(
            character=self.character,
            name="Walk Stand",
            type="FIGHTING",
            form="Humanoid",
            consciousness_level="C",
            power="C",
            speed="D",
            range="F",
            durability="D",
            precision="F",
            development="F",
        )
        CharacterXPAllocation.objects.create(
            character=self.character,
            allocation_type="LEVEL_UP_STAT",
            xp_track="playbook",
            xp_cost=10,
            metadata={"seed": True},
        )

    def test_credit_xp_walks_action_dot(self):
        from characters.models import PendingAdvance
        from characters.services.advancement import credit_xp

        create_plan_item(
            self.character,
            track="insight",
            kind="action_dot",
            payload={"action": "hunt"},
        )
        result = credit_xp(self.character, "insight", 5)
        self.character.refresh_from_db()
        self.assertEqual(result["pendings_minted"], 1)
        self.assertEqual(len(result["plan_walk"]["applied"]), 1)
        self.assertEqual(self.character.action_dots.get("hunt"), 2)
        self.assertEqual(
            PendingAdvance.objects.filter(
                character=self.character, track="insight", status="open"
            ).count(),
            0,
        )
        self.assertEqual(
            AdvancementPlanItem.objects.filter(
                character=self.character, status="queued"
            ).count(),
            0,
        )
        self.assertEqual(
            AdvancementPlanItem.objects.filter(
                character=self.character, status="applied"
            ).count(),
            1,
        )

    def test_blocked_head_skips_to_next(self):
        from characters.services.advancement import credit_xp

        # Maxed hunt — illegal head
        self.character.action_dots = {
            **self.character.action_dots,
            "hunt": 4,
            "study": 1,
        }
        self.character.save(update_fields=["action_dots"])
        head = create_plan_item(
            self.character,
            track="insight",
            kind="action_dot",
            payload={"action": "hunt"},
        )
        create_plan_item(
            self.character,
            track="insight",
            kind="action_dot",
            payload={"action": "study"},
        )
        credit_xp(self.character, "insight", 5)
        self.character.refresh_from_db()
        head.refresh_from_db()
        self.assertEqual(head.status, "queued")
        self.assertTrue(head.blocked_reason)
        self.assertEqual(self.character.action_dots.get("study"), 2)

    def test_coin_grade_walk(self):
        from characters.services.advancement import credit_xp

        create_plan_item(
            self.character,
            track="playbook",
            kind="coin_grade",
            payload={"stat": "power"},
        )
        credit_xp(self.character, "playbook", 10)
        self.character.refresh_from_db()
        self.stand.refresh_from_db()
        self.assertEqual(self.stand.power, "B")
