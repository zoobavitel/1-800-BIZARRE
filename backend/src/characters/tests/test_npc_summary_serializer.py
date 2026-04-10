from django.test import TestCase
from django.contrib.auth.models import User
from characters.models import Campaign, NPC
from characters.serializers import NPCSummarySerializer, NPCSerializer


class NPCSummarySerializerLevelTest(TestCase):
    """Test that NPCSummarySerializer computes NPC level from stand_coin_stats."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="gm", email="gm@test.com", password="testpass"
        )
        self.campaign = Campaign.objects.create(name="Test Campaign", gm=self.user)

    def _make_npc(self, stats):
        return NPC.objects.create(
            name="Test NPC",
            creator=self.user,
            campaign=self.campaign,
            stand_coin_stats=stats,
        )

    def test_empty_stats_returns_level_1(self):
        # All 6 stats default to D(1): 6 × 1 = 6 total; max(1, 6 - 9) = 1
        npc = self._make_npc({})
        data = NPCSummarySerializer(npc).data
        self.assertEqual(data["level"], 1)

    def test_all_f_grades_returns_level_1(self):
        # F=0 pts × 6 = 0 total; max(1, 0 - 9) = 1
        npc = self._make_npc(
            {
                "POWER": "F",
                "SPEED": "F",
                "RANGE": "F",
                "DURABILITY": "F",
                "PRECISION": "F",
                "DEVELOPMENT": "F",
            }
        )
        data = NPCSummarySerializer(npc).data
        self.assertEqual(data["level"], 1)

    def test_hol_horse_stats_returns_level_7(self):
        # Power C(2), Speed C(2), Range A(4), Durability A(4), Precision A(4), Development F(0)
        # total = 16; level = max(1, 16 - 9) = 7
        npc = self._make_npc(
            {
                "POWER": "C",
                "SPEED": "C",
                "RANGE": "A",
                "DURABILITY": "A",
                "PRECISION": "A",
                "DEVELOPMENT": "F",
            }
        )
        data = NPCSummarySerializer(npc).data
        self.assertEqual(data["level"], 7)

    def test_all_s_grades_returns_correct_level(self):
        # S=5 pts × 6 = 30 total; level = max(1, 30 - 9) = 21
        npc = self._make_npc(
            {
                "POWER": "S",
                "SPEED": "S",
                "RANGE": "S",
                "DURABILITY": "S",
                "PRECISION": "S",
                "DEVELOPMENT": "S",
            }
        )
        data = NPCSummarySerializer(npc).data
        self.assertEqual(data["level"], 21)

    def test_partial_stats_computes_correctly(self):
        # Missing stats default to D(1): POWER A(4) + SPEED B(3) + 4 missing×D(1) = 11
        # level = max(1, 11 - 9) = 2
        npc = self._make_npc({"POWER": "A", "SPEED": "B"})
        data = NPCSummarySerializer(npc).data
        self.assertEqual(data["level"], 2)

    def test_stored_level_field_does_not_affect_output(self):
        # Even if stored level is 1 (default), computed level should reflect stats
        npc = self._make_npc(
            {
                "POWER": "S",
                "SPEED": "S",
                "RANGE": "S",
                "DURABILITY": "S",
                "PRECISION": "S",
                "DEVELOPMENT": "S",
            }
        )
        # level field defaults to 1 in DB, but serializer should compute 21
        self.assertEqual(npc.level, 1)
        data = NPCSummarySerializer(npc).data
        self.assertEqual(data["level"], 21)

    def test_npc_serializer_level_matches_summary_serializer(self):
        # Both the summary and detail serializers must return the same computed level
        npc = self._make_npc(
            {
                "POWER": "C",
                "SPEED": "C",
                "RANGE": "A",
                "DURABILITY": "A",
                "PRECISION": "A",
                "DEVELOPMENT": "F",
            }
        )
        summary_data = NPCSummarySerializer(npc).data
        detail_data = NPCSerializer(npc).data
        self.assertEqual(summary_data["level"], 7)
        self.assertEqual(detail_data["level"], 7)
