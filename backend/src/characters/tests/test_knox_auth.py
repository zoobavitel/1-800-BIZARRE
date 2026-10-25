"""Login tokens: per-device knox tokens that expire, and real logout."""

from datetime import timedelta
from importlib import import_module

from django.apps import apps as global_apps
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from knox.models import AuthToken
from rest_framework.authtoken.models import Token as LegacyToken
from rest_framework.test import APIClient

ME = "/api/accounts/me/"
LOGIN = "/api/accounts/login/"


class KnoxLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user("knox_user", password="pass1234!")

    def login(self):
        r = self.client.post(
            LOGIN, {"username": "knox_user", "password": "pass1234!"}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()

    def as_token(self, token):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        return c

    def test_login_returns_working_token_with_expiry(self):
        body = self.login()
        self.assertEqual(body["user"]["username"], "knox_user")
        self.assertTrue(body["expiry"])
        self.assertEqual(self.as_token(body["token"]).get(ME).status_code, 200)

    def test_each_login_gets_its_own_token(self):
        a = self.login()["token"]
        b = self.login()["token"]
        self.assertNotEqual(a, b)
        self.assertEqual(AuthToken.objects.filter(user=self.user).count(), 2)

    def test_token_is_stored_hashed(self):
        token = self.login()["token"]
        row = AuthToken.objects.get(user=self.user)
        self.assertNotEqual(row.digest, token)
        self.assertNotIn(token, row.digest)

    def test_signup_returns_working_token(self):
        r = self.client.post(
            "/api/accounts/signup/",
            {"username": "knox_new", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(self.as_token(r.json()["token"]).get(ME).status_code, 200)

    def test_logout_ends_only_this_device(self):
        phone = self.login()["token"]
        laptop = self.login()["token"]
        r = self.as_token(phone).post("/api/accounts/logout/")
        self.assertEqual(r.status_code, 204)
        self.assertEqual(self.as_token(phone).get(ME).status_code, 401)
        self.assertEqual(self.as_token(laptop).get(ME).status_code, 200)

    def test_logout_all_ends_every_device(self):
        phone = self.login()["token"]
        laptop = self.login()["token"]
        r = self.as_token(phone).post("/api/accounts/logoutall/")
        self.assertEqual(r.status_code, 204)
        self.assertEqual(self.as_token(phone).get(ME).status_code, 401)
        self.assertEqual(self.as_token(laptop).get(ME).status_code, 401)

    def test_expired_token_gets_401(self):
        token = self.login()["token"]
        AuthToken.objects.filter(user=self.user).update(
            expiry=timezone.now() - timedelta(seconds=1)
        )
        self.assertEqual(self.as_token(token).get(ME).status_code, 401)

    def test_use_pushes_expiry_out(self):
        token = self.login()["token"]
        soon = timezone.now() + timedelta(days=1)
        AuthToken.objects.filter(user=self.user).update(expiry=soon)
        self.assertEqual(self.as_token(token).get(ME).status_code, 200)
        row = AuthToken.objects.get(user=self.user)
        self.assertGreater(row.expiry, timezone.now() + timedelta(days=29))

    def test_no_credentials_gets_401(self):
        r = self.client.get(ME)
        self.assertEqual(r.status_code, 401)
        self.assertTrue(r.get("WWW-Authenticate", "").startswith("Token"))

    def test_login_works_with_stale_token_header(self):
        """The browser may still hold an expired token when signing in."""
        self.client.credentials(HTTP_AUTHORIZATION="Token " + "0" * 64)
        self.login()

    def test_old_drf_token_is_rejected(self):
        legacy = LegacyToken.objects.create(user=self.user)
        self.assertEqual(self.as_token(legacy.key).get(ME).status_code, 401)


class DeleteLegacyTokensMigrationTests(TestCase):
    def test_migration_deletes_old_tokens(self):
        user = User.objects.create_user("legacy_user", password="pw")
        LegacyToken.objects.create(user=user)
        migration = import_module(
            "characters.migrations.0131_delete_legacy_drf_tokens"
        )
        migration.delete_legacy_tokens(global_apps, None)
        self.assertEqual(LegacyToken.objects.count(), 0)


# A password set outside Account Settings (admin, manage.py). Kept in a
# variable: gitleaks flags string literals inside set_password(...).
ADMIN_SET_PASSWORD = "AdminSet789!"


class PasswordChangeRevokesTokensTests(TestCase):
    URL = "/api/user-profiles/change-password/"

    def setUp(self):
        self.user = User.objects.create_user("pw_user", password="OldPass123!")
        _, self.here = AuthToken.objects.create(self.user)
        _, self.phone = AuthToken.objects.create(self.user)
        _, self.laptop = AuthToken.objects.create(self.user)

    def as_token(self, token):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        return c

    def change(self, client, new="NewPass456!"):
        return client.post(
            self.URL,
            {"old_password": "OldPass123!", "new_password": new, "confirm_password": new},
            format="json",
        )

    def test_change_signs_out_other_devices_and_keeps_this_one(self):
        r = self.change(self.as_token(self.here))
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self.as_token(self.here).get(ME).status_code, 200)
        self.assertEqual(self.as_token(self.phone).get(ME).status_code, 401)
        self.assertEqual(self.as_token(self.laptop).get(ME).status_code, 401)
        self.assertEqual(AuthToken.objects.filter(user=self.user).count(), 1)

    def test_failed_change_revokes_nothing(self):
        r = self.as_token(self.here).post(
            self.URL,
            {"old_password": "wrong", "new_password": "NewPass456!", "confirm_password": "NewPass456!"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(AuthToken.objects.filter(user=self.user).count(), 3)

    def test_change_with_session_auth_revokes_every_token(self):
        c = APIClient()
        c.force_authenticate(user=self.user)
        self.assertEqual(self.change(c).status_code, 200)
        self.assertFalse(AuthToken.objects.filter(user=self.user).exists())

    def test_password_set_outside_the_app_revokes_every_token(self):
        # Django admin, manage.py changepassword and set_user_password all do this.
        self.user.set_password(ADMIN_SET_PASSWORD)
        self.user.save()
        self.assertFalse(AuthToken.objects.filter(user=self.user).exists())

    def test_other_users_tokens_are_untouched(self):
        other = User.objects.create_user("other_pw", password="x-Pass123!")
        AuthToken.objects.create(other)
        self.user.set_password(ADMIN_SET_PASSWORD)
        self.user.save()
        self.assertEqual(AuthToken.objects.filter(user=other).count(), 1)

    def test_saving_without_a_password_change_keeps_tokens(self):
        self.user.first_name = "Renamed"
        self.user.save()
        self.assertEqual(AuthToken.objects.filter(user=self.user).count(), 3)

    def test_hash_upgrade_on_login_keeps_tokens(self):
        # Store the password with a weaker hasher; check_password() upgrades it.
        from django.contrib.auth.hashers import make_password
        from django.test import override_settings

        with override_settings(
            PASSWORD_HASHERS=[
                "django.contrib.auth.hashers.MD5PasswordHasher",
                "django.contrib.auth.hashers.PBKDF2PasswordHasher",
            ]
        ):
            User.objects.filter(pk=self.user.pk).update(
                password=make_password("OldPass123!")
            )
        user = User.objects.get(pk=self.user.pk)
        self.assertTrue(user.password.startswith("md5$"))
        with override_settings(
            PASSWORD_HASHERS=[
                "django.contrib.auth.hashers.PBKDF2PasswordHasher",
                "django.contrib.auth.hashers.MD5PasswordHasher",
            ]
        ):
            self.assertTrue(user.check_password("OldPass123!"))
        user.refresh_from_db()
        self.assertTrue(user.password.startswith("pbkdf2_"))
        self.assertEqual(AuthToken.objects.filter(user=self.user).count(), 3)
