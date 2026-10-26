"""Character actions that nothing calls are gone from the API.

take-harm, heal-harm, log-armor-expenditure, update-progress-clock and
create-template were stubs that wrote nothing. indulge-vice and
add-progress-clock wrote stress and clocks with no edit check, so any
campaign member could use them on another player's PC. The only client
was the unused useCharacterSheet hook. Clocks are created and ticked
through /api/progress-clocks/; harm and stress are saved on the sheet.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Heritage

DETAIL_ACTIONS = [
    "take-harm",
    "heal-harm",
    "log-armor-expenditure",
    "indulge-vice",
    "add-progress-clock",
    "update-progress-clock",
]


class DeadCharacterActionsRemovedTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="dead_owner", password="pw-dead-owner-1")
        gm = User.objects.create_user(username="dead_gm", password="pw-dead-gm-1")
        campaign = Campaign.objects.create(name="Dead Camp", gm=gm)
        heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        self.pc = Character.objects.create(
            user=self.owner, campaign=campaign, true_name="Dead PC", heritage=heritage, stress=3
        )
        self.client = APIClient()
        # As the owner, so a refusal can only mean the route is gone.
        self.client.force_authenticate(self.owner)

    def test_detail_actions_are_gone(self):
        for path in DETAIL_ACTIONS:
            with self.subTest(path=path):
                response = self.client.post(
                    f"/api/characters/{self.pc.id}/{path}/", {"name": "x"}, format="json"
                )
                self.assertEqual(response.status_code, 404)
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.stress, 3)

    def test_create_template_is_gone(self):
        response = self.client.post(
            "/api/characters/create-template/",
            {"name": "x", "heritage": 1, "vice": 1},
            format="json",
        )
        # The path now only matches the character detail route, which takes no POST.
        self.assertIn(response.status_code, (404, 405))
