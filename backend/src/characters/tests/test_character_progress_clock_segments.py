"""PC sheet progress clocks persist max_segments (including 7)."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Heritage, ProgressClock, Vice


class CharacterProgressClockSegmentsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="clk_u", password="x")
        self.gm = User.objects.create_user(username="clk_gm", password="x")
        self.heritage = Heritage.objects.create(name="HumanClk", base_hp=0, description="")
        self.vice = Vice.objects.create(name="VClk", description="")
        self.campaign = Campaign.objects.create(name="Clk Camp", gm=self.gm)
        self.campaign.players.add(self.user)
        dots = {
            k: 0
            for k in (
                "hunt",
                "study",
                "survey",
                "tinker",
                "finesse",
                "prowl",
                "skirmish",
                "wreck",
                "bizarre",
                "command",
                "consort",
                "sway",
            )
        }
        self.char = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name="Clock Tester",
            heritage=self.heritage,
            vice=self.vice,
            playbook="STAND",
            action_dots=dots,
            coin_stats={
                "power": "D",
                "speed": "D",
                "range": "D",
                "durability": "D",
                "precision": "D",
                "development": "D",
            },
        )
        self.client.force_authenticate(user=self.user)

    def test_patch_sheet_keeps_seven_segments_not_twelve(self):
        url = f"/api/characters/{self.char.id}/"
        res = self.client.patch(
            url,
            {
                "progress_clocks": [
                    {
                        "id": 1750000000000,
                        "name": "Wannabe",
                        "segments": 7,
                        "filled": 0,
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        clock = ProgressClock.objects.get(character=self.char, name="Wannabe")
        self.assertEqual(clock.max_segments, 7)
        self.assertEqual(clock.filled_segments, 0)

    def test_add_progress_clock_action_persists_seven(self):
        url = f"/api/characters/{self.char.id}/add-progress-clock/"
        res = self.client.post(url, {"name": "Wannabe", "segments": 7}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        self.assertEqual(res.data["max_segments"], 7)
        clock = ProgressClock.objects.get(id=res.data["id"])
        self.assertEqual(clock.max_segments, 7)

    def test_patch_progress_clock_resizes_and_clamps_fill(self):
        clock = ProgressClock.objects.create(
            name="Heat",
            clock_type="COUNTDOWN",
            max_segments=8,
            filled_segments=6,
            character=self.char,
            campaign=self.campaign,
            created_by=self.user,
        )
        res = self.client.patch(
            f"/api/progress-clocks/{clock.id}/",
            {"max_segments": 4},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        clock.refresh_from_db()
        self.assertEqual(clock.max_segments, 4)
        self.assertEqual(clock.filled_segments, 4)
