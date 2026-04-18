"""Heritage HP: optional detriments add hp_value; optional benefits spend hp_cost; required rows are ignored for budgeting."""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory

from characters.models import Benefit, Character, Detriment, Heritage
from characters.serializers import CharacterSerializer


class HeritageHpBudgetSerializerTests(TestCase):
    """CharacterSerializer.validate heritage HP pool (SRD-aligned)."""

    def setUp(self):
        self.user = User.objects.create_user(username="hp_budget_user", password="x")
        self.factory = APIRequestFactory()
        self.heritage = Heritage.objects.create(
            name="Fixture Heritage HP",
            base_hp=2,
            description="Test heritage for HP budgeting.",
        )
        self.det_req_a = Detriment.objects.create(
            heritage=self.heritage,
            name="Required Det A",
            hp_value=50,
            required=True,
            description="Required; HP must not count toward pool.",
        )
        self.det_req_b = Detriment.objects.create(
            heritage=self.heritage,
            name="Required Det B",
            hp_value=50,
            required=True,
            description="Required; HP must not count toward pool.",
        )
        self.ben_req = Benefit.objects.create(
            heritage=self.heritage,
            name="Required Benefit",
            hp_cost=50,
            required=True,
            description="Required; cost must not count toward pool.",
        )
        self.det_opt = Detriment.objects.create(
            heritage=self.heritage,
            name="Optional Detriment",
            hp_value=2,
            required=False,
            description="+2 HP toward pool.",
        )
        self.ben_opt_cheap = Benefit.objects.create(
            heritage=self.heritage,
            name="Optional Cheap Benefit",
            hp_cost=1,
            required=False,
            description="-1 HP.",
        )
        self.ben_opt_expensive = Benefit.objects.create(
            heritage=self.heritage,
            name="Optional Expensive Benefit",
            hp_cost=5,
            required=False,
            description="-5 HP.",
        )
        self.char = Character.objects.create(
            user=self.user,
            true_name="HP Budget Char",
            heritage=self.heritage,
            playbook="SPIN",
            coin_stats={
                "power": "F",
                "speed": "F",
                "range": "F",
                "durability": "F",
                "precision": "F",
                "development": "F",
            },
            action_dots={},
            trauma=[],
            xp_clocks={},
            stress=0,
            bonus_hp_from_xp=0,
        )
        self.char.selected_benefits.set([self.ben_req])
        self.char.selected_detriments.set([self.det_req_a, self.det_req_b])

    def _request(self):
        req = self.factory.patch("/api/characters/")
        req.user = self.user
        return req

    def _base_payload(self):
        """Minimal fields so heritage validation runs with full required picks."""
        return {
            "heritage": self.heritage.id,
            "selected_benefits": [self.ben_req.id],
            "selected_detriments": [self.det_req_a.id, self.det_req_b.id],
        }

    def test_only_required_picks_valid_despite_large_row_hp(self):
        """base_hp + optional gain (0) must cover optional cost (0); required row hp ignored."""
        serializer = CharacterSerializer(
            instance=self.char,
            data=self._base_payload(),
            partial=True,
            context={"request": self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_optional_benefit_alone_fails_when_exceeds_base(self):
        data = {
            **self._base_payload(),
            "selected_benefits": [
                self.ben_req.id,
                self.ben_opt_expensive.id,
            ],
        }
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={"request": self._request()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)
        self.assertIn("HP budget exceeded", str(serializer.errors["non_field_errors"][0]))

    def test_optional_detriment_covers_optional_benefit_cost(self):
        ben_second = Benefit.objects.create(
            heritage=self.heritage,
            name="Optional Cheap B",
            hp_cost=1,
            required=False,
            description="-1 HP.",
        )
        # Two optional benefits at 1 HP each => cost 2; base 2 alone is tight at 0 gain — add optional det +2.
        data = {
            **self._base_payload(),
            "selected_benefits": [
                self.ben_req.id,
                self.ben_opt_cheap.id,
                ben_second.id,
            ],
            "selected_detriments": [
                self.det_req_a.id,
                self.det_req_b.id,
                self.det_opt.id,
            ],
        }
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={"request": self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_bonus_hp_from_xp_counts_toward_optional_budget(self):
        data = {
            **self._base_payload(),
            "bonus_hp_from_xp": 2,
            "selected_benefits": [
                self.ben_req.id,
                self.ben_opt_expensive.id,
            ],
        }
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={"request": self._request()},
        )
        # base 2 + bonus 2 = 4; optional cost 5 => still invalid
        self.assertFalse(serializer.is_valid())

        data["bonus_hp_from_xp"] = 3
        serializer = CharacterSerializer(
            instance=self.char,
            data=data,
            partial=True,
            context={"request": self._request()},
        )
        # base 2 + bonus 3 = 5 >= optional cost 5
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_partial_patch_omitting_benefits_uses_instance_m2m(self):
        """PATCH without selected_benefits/detriments must use instance M2M for validation."""
        serializer = CharacterSerializer(
            instance=self.char,
            data={"stress": 1},
            partial=True,
            context={"request": self._request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_explicit_empty_selected_benefits_still_requires_required(self):
        """Explicit [] must not fall back to instance (client clearing picks)."""
        serializer = CharacterSerializer(
            instance=self.char,
            data={
                "heritage": self.heritage.id,
                "selected_benefits": [],
                "selected_detriments": [
                    self.det_req_a.id,
                    self.det_req_b.id,
                ],
            },
            partial=True,
            context={"request": self._request()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)
        self.assertIn(
            "Missing required benefits",
            str(serializer.errors["non_field_errors"][0]),
        )
