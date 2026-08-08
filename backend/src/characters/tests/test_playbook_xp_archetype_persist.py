"""playbook_xp_archetypes + Stand.type round-trip on character PUT."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Character, Heritage, Stand, Vice


class PlaybookXpArchetypePersistTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="arch_u", password="x")
        self.heritage = Heritage.objects.create(
            name="HumanArch", base_hp=0, description=""
        )
        self.vice = Vice.objects.create(name="VArch", description="")
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
            true_name="Archetype Tester",
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
            playbook_xp_archetypes=[],
        )
        Stand.objects.create(
            character=self.char,
            name="Test Stand",
            type="FIGHTING",
            form="Humanoid",
            consciousness_level="C",
            power="D",
            speed="D",
            range="D",
            durability="D",
            precision="D",
            development="D",
            armor=0,
        )

    def test_put_persists_archetypes_and_stand_type(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/characters/{self.char.id}/"
        payload = {
            "true_name": self.char.true_name,
            "heritage": self.heritage.id,
            "playbook": "STAND",
            "playbook_xp_archetypes": ["PHENOMENA"],
            "action_dots": self.char.action_dots,
            "coin_stats": self.char.coin_stats,
            "stand": {
                "name": "Test Stand",
                "type": "PHENOMENA",
                "power": "D",
                "speed": "D",
                "range": "D",
                "durability": "D",
                "precision": "D",
                "development": "D",
            },
        }
        r = self.client.put(url, payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("playbook_xp_archetypes"), ["PHENOMENA"])
        self.char.refresh_from_db()
        self.assertEqual(self.char.playbook_xp_archetypes, ["PHENOMENA"])
        stand = Stand.objects.get(character=self.char)
        self.assertEqual(stand.type, "PHENOMENA")
