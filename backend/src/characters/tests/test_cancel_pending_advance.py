"""cancel_pending_advance: forfeit open pending → (cap-1) unallocated + 1 track mark."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    Crew,
    Heritage,
    PendingAdvance,
)
from characters.services.advancement import (
    AdvancementError,
    cancel_pending_advance,
    credit_xp,
)


class CancelPendingAdvanceServiceTests(TestCase):
    def setUp(self):
        self.player = User.objects.create_user(username="pl_cpa", password="pw")
        self.gm = User.objects.create_user(username="gm_cpa", password="pw")
        self.campaign = Campaign.objects.create(name="CPA Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="CPA Crew", campaign=self.campaign)
        self.heritage, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "t"},
        )
        self.character = Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            crew=self.crew,
            true_name="CPA PC",
            heritage=self.heritage,
            xp_clocks={
                "insight": 0,
                "prowess": 0,
                "resolve": 0,
                "heritage": 0,
                "playbook": 0,
            },
            unallocated_xp=0,
        )

    def test_playbook_refunds_nine_pool_one_track(self):
        credit_xp(self.character, "playbook", 10, save=True, walk_plan=False)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 0)
        self.assertEqual(
            PendingAdvance.objects.filter(
                character=self.character, track="playbook", status="open"
            ).count(),
            1,
        )
        result = cancel_pending_advance(self.character, "playbook", save=True)
        self.character.refresh_from_db()
        self.assertEqual(result["pool_refund"], 9)
        self.assertEqual(result["track_refund"], 1)
        self.assertEqual(self.character.unallocated_xp, 9)
        self.assertEqual(self.character.xp_clocks.get("playbook"), 1)
        self.assertEqual(
            PendingAdvance.objects.filter(
                character=self.character, track="playbook", status="open"
            ).count(),
            0,
        )

    def test_attribute_refunds_four_pool_one_track(self):
        credit_xp(self.character, "insight", 5, save=True, walk_plan=False)
        self.character.refresh_from_db()
        result = cancel_pending_advance(self.character, "insight", save=True)
        self.character.refresh_from_db()
        self.assertEqual(result["pool_refund"], 4)
        self.assertEqual(self.character.unallocated_xp, 4)
        self.assertEqual(self.character.xp_clocks.get("insight"), 1)

    def test_fifo_cancels_oldest(self):
        credit_xp(self.character, "prowess", 10, save=True, walk_plan=False)
        self.character.refresh_from_db()
        opens = list(
            PendingAdvance.objects.filter(
                character=self.character, track="prowess", status="open"
            ).order_by("created_at", "id")
        )
        self.assertEqual(len(opens), 2)
        oldest_id = opens[0].id
        result = cancel_pending_advance(self.character, "prowess", save=True)
        self.assertEqual(result["cancelled_pending_id"], oldest_id)
        self.assertEqual(result["open_pending_count"], 1)
        self.assertFalse(PendingAdvance.objects.filter(pk=oldest_id).exists())

    def test_no_pending_raises(self):
        with self.assertRaises(AdvancementError) as ctx:
            cancel_pending_advance(self.character, "playbook", save=True)
        self.assertEqual(ctx.exception.code, "not_found")

    def test_cancel_does_not_remint_via_credit_xp(self):
        """+1 mark alone must not fill a cap and mint again."""
        credit_xp(self.character, "resolve", 5, save=True, walk_plan=False)
        # Leave leftover at 4 so +1 → 5 would mint if credit_xp were used wrongly.
        self.character.xp_clocks = {**self.character.xp_clocks, "resolve": 4}
        self.character.save(update_fields=["xp_clocks"])
        cancel_pending_advance(self.character, "resolve", save=True)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("resolve"), 5)
        self.assertEqual(
            PendingAdvance.objects.filter(
                character=self.character, track="resolve", status="open"
            ).count(),
            0,
        )


class CancelPendingAdvanceAPITests(TestCase):
    def setUp(self):
        self.player = User.objects.create_user(username="pl_cpa_api", password="pw")
        self.gm = User.objects.create_user(username="gm_cpa_api", password="pw")
        self.other = User.objects.create_user(username="other_cpa", password="pw")
        self.campaign = Campaign.objects.create(name="CPA API", gm=self.gm)
        self.crew = Crew.objects.create(name="CPA API Crew", campaign=self.campaign)
        self.heritage, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "t"},
        )
        self.character = Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            crew=self.crew,
            true_name="CPA API PC",
            heritage=self.heritage,
            xp_clocks={
                "insight": 0,
                "prowess": 0,
                "resolve": 0,
                "heritage": 0,
                "playbook": 0,
            },
            unallocated_xp=0,
        )
        self.client = APIClient()

    def test_owner_can_cancel(self):
        credit_xp(self.character, "playbook", 10, save=True, walk_plan=False)
        self.client.force_authenticate(user=self.player)
        res = self.client.post(
            f"/api/characters/{self.character.id}/cancel-pending-advance/",
            {"track": "playbook"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["unallocated_xp"], 9)
        self.assertEqual(res.data["xp_clocks"]["playbook"], 1)

    def test_stranger_forbidden(self):
        credit_xp(self.character, "playbook", 10, save=True, walk_plan=False)
        self.client.force_authenticate(user=self.other)
        res = self.client.post(
            f"/api/characters/{self.character.id}/cancel-pending-advance/",
            {"track": "playbook"},
            format="json",
        )
        # ViewSet queryset hides characters the stranger cannot see → 404;
        # when visible, PermissionDenied → 403.
        self.assertIn(res.status_code, (403, 404))
