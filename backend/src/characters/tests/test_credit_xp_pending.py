"""Plan A credit_xp fill-clear and PendingAdvance minting."""

from django.contrib.auth.models import User
from django.test import TestCase

from characters.models import Character, Heritage, PendingAdvance, Roll, Session, Campaign
from characters.roll_helpers import (
    award_desperate_action_xp,
    award_innate_stand_dice_xp,
)
from characters.services.advancement import credit_xp
from characters.services.xp_allocation import (
    XPAllocationError,
    apply_buy_hp,
    apply_level_up,
    apply_minor_advance,
    apply_unlock_second_playbook,
)


class CreditXpPendingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("credit_xp_user", password="x")
        self.heritage = Heritage.objects.create(name="Human", base_hp=0)
        self.character = Character.objects.create(
            user=self.user,
            true_name="Credit XP PC",
            heritage=self.heritage,
            playbook="STAND",
            coin_stats={
                "power": "F",
                "speed": "D",
                "range": "F",
                "durability": "D",
                "precision": "F",
                "development": "F",
            },
            action_dots={"hunt": 0, "study": 1},
            trauma=[],
            xp_clocks={},
            stress=0,
        )

    def test_twelve_insight_mints_two_pendings_leftover_two(self):
        result = credit_xp(self.character, "insight", 12)
        self.character.refresh_from_db()
        self.assertEqual(result["pendings_minted"], 2)
        self.assertEqual(result["marks"], 2)
        self.assertEqual(self.character.xp_clocks.get("insight"), 2)
        self.assertEqual(
            PendingAdvance.objects.filter(
                character=self.character, track="insight", status="open"
            ).count(),
            2,
        )

    def test_three_plus_three_insight_one_pending_leftover_one(self):
        credit_xp(self.character, "insight", 3)
        credit_xp(self.character, "insight", 3)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("insight"), 1)
        self.assertEqual(
            PendingAdvance.objects.filter(
                character=self.character, track="insight", status="open"
            ).count(),
            1,
        )

    def test_desperate_zero_dot_grants_two(self):
        campaign = Campaign.objects.create(name="C", gm=self.user)
        session = Session.objects.create(campaign=campaign, name="S1")
        self.character.campaign = campaign
        self.character.save(update_fields=["campaign"])
        roll = Roll.objects.create(
            character=self.character,
            session=session,
            roll_type="ACTION",
            position="desperate",
            action_name="hunt",
            pool_action_rating=0,
            results=[3],
            outcome="FAILURE",
        )
        xp, track = award_desperate_action_xp(
            self.character, session, roll, "hunt", self.user
        )
        self.assertEqual(xp, 2)
        self.assertEqual(track, "insight")
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("insight"), 2)

    def test_desperate_power_zero_dot_two_playbook(self):
        campaign = Campaign.objects.create(name="C2", gm=self.user)
        session = Session.objects.create(campaign=campaign, name="S2")
        self.character.campaign = campaign
        self.character.save(update_fields=["campaign"])
        roll = Roll.objects.create(
            character=self.character,
            session=session,
            roll_type="ACTION",
            position="desperate",
            action_name="power",
            pool_action_rating=0,
            results=[2],
            outcome="FAILURE",
        )
        xp, track = award_innate_stand_dice_xp(
            self.character, session, roll, "power", self.user, stand_stat="power"
        )
        self.assertEqual(xp, 2)
        self.assertEqual(track, "playbook")
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 2)

    def test_unlock_second_playbook_raises(self):
        with self.assertRaises(XPAllocationError):
            apply_unlock_second_playbook(self.character, secondary_playbook="HAMON")

    def test_redeem_heritage_pending_grants_hp(self):
        credit_xp(self.character, "heritage", 5)
        self.assertEqual(
            PendingAdvance.objects.filter(
                character=self.character, track="heritage", status="open"
            ).count(),
            1,
        )
        alloc = apply_buy_hp(self.character, xp_track="heritage")
        self.character.refresh_from_db()
        self.assertEqual(self.character.bonus_hp_from_xp, 1)
        self.assertEqual(self.character.xp_clocks.get("heritage"), 0)
        pending = PendingAdvance.objects.get(pk=alloc.metadata["pending_id"])
        self.assertEqual(pending.status, "redeemed_manual")

    def test_redeem_attribute_pending_grants_dot(self):
        credit_xp(self.character, "insight", 5)
        alloc = apply_minor_advance(
            self.character, xp_track="insight", action="hunt"
        )
        self.character.refresh_from_db()
        self.assertEqual(int(self.character.action_dots.get("hunt") or 0), 1)
        self.assertTrue(alloc.metadata.get("from_pending"))

    def test_level_up_from_pool_rejected(self):
        self.character.unallocated_xp = 20
        self.character.save(update_fields=["unallocated_xp"])
        with self.assertRaises(XPAllocationError):
            apply_level_up(
                self.character,
                xp_track="playbook",
                choice="stat",
                stand_stat="speed",
                from_pool=True,
            )

    def test_acquire_stand_for_spin(self):
        self.character.playbook = "SPIN"
        self.character.coin_stats = {
            k: "F"
            for k in [
                "power",
                "speed",
                "range",
                "durability",
                "precision",
                "development",
            ]
        }
        self.character.save()
        credit_xp(self.character, "playbook", 10)
        alloc = apply_level_up(
            self.character,
            xp_track="playbook",
            choice="acquire_stand",
        )
        self.character.refresh_from_db()
        self.assertEqual(alloc.allocation_type, "LEVEL_UP_ACQUIRE_STAND")
        self.assertEqual(self.character.coin_stats.get("power"), "D")
        self.assertEqual(self.character.coin_stats.get("development"), "D")
        self.assertTrue(alloc.metadata.get("from_pending"))
