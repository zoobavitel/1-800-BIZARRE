"""Roster/home level comes from Stand grades and action dots, not Character.level."""

from django.contrib.auth.models import User
from django.test import TestCase

from characters.models import Character, Heritage, Stand
from characters.serializers import CharacterSerializer, CharacterSummarySerializer
from characters.services.xp_allocation import compute_pc_level


def _dots_seven():
    return {
        "hunt": 1,
        "study": 1,
        "survey": 1,
        "tinker": 1,
        "finesse": 1,
        "prowl": 1,
        "skirmish": 1,
        "wreck": 0,
        "attune": 0,
        "command": 0,
        "consort": 0,
        "sway": 0,
    }


class ComputePcLevelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="pc", password="testpass123")
        self.heritage = Heritage.objects.create(name="Human", base_hp=0, description="")
        self.character = Character.objects.create(
            user=self.user,
            true_name="Thibault Paradis",
            stand_name="House in The Rising Sun",
            heritage=self.heritage,
            level=3,
            action_dots=_dots_seven(),
        )
        Stand.objects.create(
            character=self.character,
            name="House in The Rising Sun",
            type="FIGHTING",
            form="Humanoid",
            consciousness_level="C",
            power="C",
            speed="C",
            range="C",
            durability="C",
            precision="C",
            development="D",
        )

    def test_stored_level_3_serializes_as_sheet_level_6(self):
        # Five D→C bumps on a 6-point / 7-dot baseline: spent 145 → level 6.
        self.assertEqual(self.character.level, 3)
        self.assertEqual(compute_pc_level(self.character), 6)
        summary = CharacterSummarySerializer(self.character).data
        detail = CharacterSerializer(self.character).data
        self.assertEqual(summary["level"], 6)
        self.assertEqual(summary["heritage_name"], "Human")
        self.assertEqual(detail["level"], 6)
        self.character.refresh_from_db()
        self.assertEqual(self.character.level, 3)

    def test_attune_and_bizarre_count_once(self):
        self.character.action_dots = {**_dots_seven(), "attune": 2, "bizarre": 2}
        self.character.save(update_fields=["action_dots"])
        # 7 other dots + max(attune, bizarre)=2 → 9 dots. Double-counting both
        # keys would be 11 dots and level 8.
        self.assertEqual(compute_pc_level(self.character), 7)
