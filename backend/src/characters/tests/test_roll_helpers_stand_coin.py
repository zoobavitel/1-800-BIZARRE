"""Stand Coin roll pool helpers (SRD_DEV grade → dice count)."""

from django.test import SimpleTestCase

from characters.roll_helpers import stand_action_rating_from_character


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
