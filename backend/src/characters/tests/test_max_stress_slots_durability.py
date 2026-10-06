"""SRD_DEV: stress track length follows Stand Durability grade."""
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase

from characters.models import Campaign, Character, Crew, Heritage, Stand
from characters.roll_helpers import (
    max_stress_slots_for_character,
    stress_slots_from_durability_grade,
)


class MaxStressSlotsDurabilityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="stress_pc", password="pass")
        self.gm = User.objects.create_user(username="stress_gm", password="pass")
        self.campaign = Campaign.objects.create(name="Stress Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="Stress Crew", campaign=self.campaign)
        self.h, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "test"},
        )
        self.dots = {
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
        }

    def _make_pc(self, *, durability=None, stress=0, with_stand=True, level=2):
        coin = None
        if durability is not None:
            coin = {
                "power": "D",
                "speed": "D",
                "range": "D",
                "durability": durability,
                "precision": "D",
                "development": "D",
            }
        pc = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Stress PC",
            heritage=self.h,
            action_dots=self.dots,
            stress=stress,
            level=level,
            playbook="STAND" if with_stand else "HAMON",
            coin_stats=coin or {},
        )
        if with_stand and durability is not None:
            Stand.objects.create(
                character=pc,
                name="Test Stand",
                power="D",
                speed="D",
                range="D",
                durability=durability,
                precision="D",
                development="D",
            )
        return pc

    def test_grade_table(self):
        self.assertEqual(stress_slots_from_durability_grade("F"), 8)
        self.assertEqual(stress_slots_from_durability_grade("D"), 9)
        self.assertEqual(stress_slots_from_durability_grade("C"), 10)
        self.assertEqual(stress_slots_from_durability_grade("B"), 11)
        self.assertEqual(stress_slots_from_durability_grade("A"), 12)
        self.assertEqual(stress_slots_from_durability_grade("S"), 12)
        self.assertEqual(stress_slots_from_durability_grade(""), 9)
        self.assertEqual(stress_slots_from_durability_grade(None), 9)

    def test_f_through_a_from_stand(self):
        for grade, expected in (
            ("F", 8),
            ("D", 9),
            ("C", 10),
            ("B", 11),
            ("A", 12),
            ("S", 12),
        ):
            pc = self._make_pc(durability=grade)
            self.assertEqual(
                max_stress_slots_for_character(pc),
                expected,
                msg=f"grade {grade}",
            )
            pc.delete()

    def test_no_stand_defaults_to_nine(self):
        pc = self._make_pc(durability=None, with_stand=False)
        self.assertEqual(max_stress_slots_for_character(pc), 9)

    def test_validation_rejects_filled_above_max(self):
        pc = self._make_pc(durability="F", stress=8, level=1)
        pc.stress = 9
        with self.assertRaises(ValidationError) as ctx:
            pc._validate_stress_based_on_durability()
        self.assertIn("stress", ctx.exception.message_dict)

    def test_validation_allows_filled_at_max(self):
        pc = self._make_pc(durability="F", stress=8, level=1)
        pc._validate_stress_based_on_durability()  # must not raise
