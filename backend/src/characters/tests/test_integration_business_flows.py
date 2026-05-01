"""Integration tests for top business flows in the test pyramid."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Crew, Heritage, Session


class AuthBootstrapIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_signup_then_me_happy_path(self):
        signup = self.client.post(
            "/api/accounts/signup/",
            {"username": "auth_flow_user", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(signup.status_code, status.HTTP_201_CREATED, signup.data)
        token = signup.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        me = self.client.get("/api/accounts/me/")
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data["username"], "auth_flow_user")

    def test_login_failure_with_wrong_password(self):
        User.objects.create_user(username="auth_bad_pw", password="CorrectPass123!")
        login = self.client.post(
            "/api/accounts/login/",
            {"username": "auth_bad_pw", "password": "WrongPass"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", login.data)


class CharacterLifecycleIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="char_owner", password="pass1234")
        self.other_user = User.objects.create_user(
            username="char_other", password="pass1234"
        )
        self.heritage = Heritage.objects.create(name="Human", base_hp=0, description="")
        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_create_patch_delete_happy_path(self):
        created = self.client.post(
            "/api/characters/",
            {"true_name": "Flow Hero", "heritage": self.heritage.id},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        char_id = created.data["id"]

        patched = self.client.patch(
            f"/api/characters/{char_id}/",
            {"alias": "Updated Alias"},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual(patched.data.get("alias"), "Updated Alias")

        deleted = self.client.delete(f"/api/characters/{char_id}/")
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)

    def test_unauthorized_user_cannot_delete_other_character(self):
        owned = Character.objects.create(
            user=self.user, true_name="Owned Character", heritage=self.heritage
        )
        other_token, _ = Token.objects.get_or_create(user=self.other_user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {other_token.key}")
        denied = self.client.delete(f"/api/characters/{owned.id}/")
        self.assertEqual(denied.status_code, status.HTTP_404_NOT_FOUND)


class SessionRollLoopIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm_loop", password="pass1234")
        self.player_user = User.objects.create_user(
            username="player_loop", password="pass1234"
        )
        self.heritage = Heritage.objects.create(name="Human", base_hp=0, description="")
        self.campaign = Campaign.objects.create(name="Loop Campaign", gm=self.gm)
        self.crew = Crew.objects.create(name="Loop Crew", campaign=self.campaign)
        self.player = Character.objects.create(
            user=self.player_user,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Roller",
            heritage=self.heritage,
            action_dots={
                "hunt": 1,
                "study": 0,
                "survey": 0,
                "tinker": 0,
                "finesse": 0,
                "prowl": 0,
                "skirmish": 0,
                "wreck": 0,
                "bizarre": 0,
                "command": 0,
                "consort": 0,
                "sway": 0,
            },
            stress=5,
        )
        self.session = Session.objects.create(
            campaign=self.campaign,
            name="S1",
            default_position="risky",
            default_effect="standard",
        )
        player_token, _ = Token.objects.get_or_create(user=self.player_user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {player_token.key}")

    def test_roll_action_creates_session_roll_happy_path(self):
        rolled = self.client.post(
            f"/api/characters/{self.player.id}/roll-action/",
            {"action": "hunt", "session_id": self.session.id},
            format="json",
        )
        self.assertEqual(rolled.status_code, status.HTTP_200_OK, rolled.data)
        self.assertEqual(rolled.data["position"], "risky")
        self.assertEqual(rolled.data["effect"], "standard")
        self.assertIsNotNone(rolled.data["roll_id"])

    def test_roll_action_uses_per_character_position_effect_map(self):
        self.session.position_effect_by_character = {
            str(self.player.id): {"position": "controlled", "effect": "extreme"},
        }
        self.session.save(update_fields=["position_effect_by_character"])
        rolled = self.client.post(
            f"/api/characters/{self.player.id}/roll-action/",
            {"action": "hunt", "session_id": self.session.id},
            format="json",
        )
        self.assertEqual(rolled.status_code, status.HTTP_200_OK, rolled.data)
        self.assertEqual(rolled.data["position"], "controlled")
        self.assertEqual(rolled.data["effect"], "extreme")

    def test_roll_action_requires_action_for_action_rolls(self):
        rolled = self.client.post(
            f"/api/characters/{self.player.id}/roll-action/",
            {"session_id": self.session.id},
            format="json",
        )
        self.assertEqual(rolled.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", rolled.data)
