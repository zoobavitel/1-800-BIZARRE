"""Stand Coin roll pool helpers (SRD_DEV grade → dice count)."""

from django.test import SimpleTestCase

from characters.roll_helpers import (
    STAND_ACTION_STAT_KEYS,
    STAND_RESIST_STAT_KEYS,
    resistance_stress_cost,
    stand_action_rating_from_character,
)


class _StubChr:
    def __init__(self, coin_stats=None, stand=None):
        self.coin_stats = coin_stats if coin_stats is not None else {}
        self.stand = stand


class _StubStand:
    def __init__(self, precision="C"):
        self.precision = precision


class StandCoinRollHelperTests(SimpleTestCase):
    def test_coin_stats_grade_maps_to_pool(self):
        ch = _StubChr(
            coin_stats={
                "power": "A",
                "speed": "B",
                "durability": "F",
                "precision": "D",
            }
        )
        self.assertEqual(stand_action_rating_from_character(ch, "power"), 4)
        self.assertEqual(stand_action_rating_from_character(ch, "speed"), 3)
        self.assertEqual(stand_action_rating_from_character(ch, "durability"), 0)
        self.assertEqual(stand_action_rating_from_character(ch, "precision"), 1)

    def test_stand_model_overrides_coin_stats(self):
        ch = _StubChr(coin_stats={"precision": "A"}, stand=_StubStand("D"))
        self.assertEqual(stand_action_rating_from_character(ch, "precision"), 1)


class StandCoinActionKeysTests(SimpleTestCase):
    def test_durability_is_resist_not_coin_action(self):
        self.assertEqual(STAND_ACTION_STAT_KEYS, frozenset({"power", "speed", "precision"}))
        self.assertEqual(STAND_RESIST_STAT_KEYS, frozenset({"durability"}))
        self.assertNotIn("durability", STAND_ACTION_STAT_KEYS)


class ResistanceStressCostTests(SimpleTestCase):
    def test_highest_six_costs_zero(self):
        self.assertEqual(resistance_stress_cost([6, 2, 1]), 0)

    def test_highest_five_costs_one(self):
        self.assertEqual(resistance_stress_cost([5, 4]), 1)

    def test_two_sixes_clear_one(self):
        self.assertEqual(resistance_stress_cost([6, 6]), -1)
        self.assertEqual(resistance_stress_cost([6, 6, 3]), -1)

    def test_zero_dice_cannot_crit(self):
        self.assertEqual(resistance_stress_cost([6, 6], zero_dice=True), 0)
        self.assertEqual(resistance_stress_cost([6, 2], zero_dice=True), 4)
