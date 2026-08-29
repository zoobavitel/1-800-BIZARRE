"""Stand coin grades: Stand is writable source; partial PATCH must not stomp to D."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from characters.models import Character, Heritage, Stand
from characters.views.character_views import CharacterViewSet


def _make_character(**kwargs):
    user = kwargs.pop("user", None)
    if user is None:
        user = User.objects.create_user(
            username=kwargs.pop("username", "stand_coin_user"),
            password="x",
        )
    else:
        kwargs.pop("username", None)
    heritage, _ = Heritage.objects.get_or_create(
        name="Human", defaults={"base_hp": 0, "description": ""}
    )
    defaults = {
        "user": user,
        "true_name": "Coin Tester",
        "playbook": "STAND",
        "level": 1,
        "heritage": heritage,
        "action_dots": {
            "hunt": 1,
            "study": 1,
            "survey": 1,
            "tinker": 1,
            "finesse": 1,
            "prowl": 1,
            "skirmish": 1,
        },
        "stress": 9,
        "coin_stats": {
            "power": "A",
            "speed": "C",
            "range": "F",
            "durability": "D",
            "precision": "D",
            "development": "D",
        },
    }
    defaults.update(kwargs)
    character = Character.objects.create(**defaults)
    Stand.objects.create(
        character=character,
        name="Test Stand",
        type="FIGHTING",
        form="Humanoid",
        forms=["Humanoid"],
        consciousness_level="C",
        power="A",
        speed="C",
        range="F",
        durability="D",
        precision="D",
        development="D",
        armor=0,
    )
    character.coin_stats = {
        "power": "A",
        "speed": "C",
        "range": "F",
        "durability": "D",
        "precision": "D",
        "development": "D",
    }
    character.save(update_fields=["coin_stats"])
    return character


class StandCoinChargenPersistTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(username="persist_u", password="x")
        self.character = _make_character(user=self.user, username="persist_u2")

    def test_partial_stand_power_patch_leaves_other_grades(self):
        request = self.factory.patch(
            f"/api/characters/{self.character.id}/",
            {"stand": {"power": "B"}},
            format="json",
        )
        force_authenticate(request, user=self.user)
        view = CharacterViewSet.as_view({"patch": "partial_update"})
        response = view(request, pk=self.character.id)
        self.assertEqual(response.status_code, 200, response.data)
        self.character.refresh_from_db()
        stand = self.character.stand
        self.assertEqual(stand.power, "B")
        self.assertEqual(stand.speed, "C")
        self.assertEqual(stand.range, "F")
        self.assertEqual(stand.durability, "D")
        self.assertEqual(self.character.coin_stats.get("power"), "B")
        self.assertEqual(self.character.coin_stats.get("speed"), "C")

    def test_partial_coin_stats_only_does_not_stomp_missing_to_d(self):
        """Legacy client sending one coin_stats key must not wipe other Stand fields."""
        request = self.factory.patch(
            f"/api/characters/{self.character.id}/",
            {"coin_stats": {"power": "B"}},
            format="json",
        )
        force_authenticate(request, user=self.user)
        view = CharacterViewSet.as_view({"patch": "partial_update"})
        response = view(request, pk=self.character.id)
        self.assertEqual(response.status_code, 200, response.data)
        self.character.refresh_from_db()
        stand = self.character.stand
        self.assertEqual(stand.power, "B")
        self.assertEqual(stand.speed, "C")
        self.assertEqual(stand.range, "F")

    def test_name_only_patch_leaves_stand_grades(self):
        request = self.factory.patch(
            f"/api/characters/{self.character.id}/",
            {"true_name": "Renamed"},
            format="json",
        )
        force_authenticate(request, user=self.user)
        view = CharacterViewSet.as_view({"patch": "partial_update"})
        response = view(request, pk=self.character.id)
        self.assertEqual(response.status_code, 200, response.data)
        self.character.refresh_from_db()
        stand = self.character.stand
        self.assertEqual(self.character.true_name, "Renamed")
        self.assertEqual(stand.power, "A")
        self.assertEqual(stand.speed, "C")
        self.assertEqual(stand.range, "F")

    def test_update_field_rejects_coin_stats(self):
        request = self.factory.post(
            f"/api/characters/{self.character.id}/update_field/",
            {"field": "coin_stats", "value": {"power": "S"}},
            format="json",
        )
        force_authenticate(request, user=self.user)
        view = CharacterViewSet.as_view({"post": "update_field"})
        response = view(request, pk=self.character.id)
        self.assertEqual(response.status_code, 400)

    def test_create_round_trip_nonuniform_grades(self):
        heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        payload = {
            "true_name": "Fresh Coin",
            "playbook": "STAND",
            "level": 1,
            "stress": 9,
            "heritage": heritage.id,
            "action_dots": {
                "hunt": 1,
                "study": 1,
                "survey": 1,
                "tinker": 1,
                "finesse": 1,
                "prowl": 1,
                "skirmish": 1,
            },
            "stand": {
                "name": "Odd Stand",
                "type": "FIGHTING",
                "power": "A",
                "speed": "C",
                "range": "F",
                "durability": "B",
                "precision": "D",
                "development": "D",
            },
            "coin_stats": {
                "power": "A",
                "speed": "C",
                "range": "F",
                "durability": "B",
                "precision": "D",
                "development": "D",
            },
        }
        request = self.factory.post("/api/characters/", payload, format="json")
        force_authenticate(request, user=self.user)
        view = CharacterViewSet.as_view({"post": "create"})
        response = view(request)
        self.assertEqual(response.status_code, 201, response.data)
        character = Character.objects.get(pk=response.data["id"])
        stand = character.stand
        self.assertEqual(stand.power, "A")
        self.assertEqual(stand.speed, "C")
        self.assertEqual(stand.range, "F")
        self.assertEqual(stand.durability, "B")
