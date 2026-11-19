"""Login and signup throttles (app/throttles.py)."""

from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient

from app import throttles

LOGIN = "/api/accounts/login/"
SIGNUP = "/api/accounts/signup/"
PASSWORD = "pass1234!"


class LoginThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user("throttle_user", password=PASSWORD)

    def fail(self, username="throttle_user", ip="10.0.0.1", **extra):
        return self.client.post(
            LOGIN,
            {"username": username, "password": "wrong-password"},
            format="json",
            REMOTE_ADDR=ip,
            **extra,
        )

    def succeed(self, ip="10.0.0.1", **extra):
        return self.client.post(
            LOGIN,
            {"username": "throttle_user", "password": PASSWORD},
            format="json",
            REMOTE_ADDR=ip,
            **extra,
        )

    def test_username_limit_blocks_even_the_right_password(self):
        for _ in range(throttles.LOGIN_LIMIT_PER_USER):
            self.assertEqual(self.fail().status_code, 400)
        r = self.succeed()
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.json()["message"], throttles.LOGIN_MESSAGE)
        self.assertIn("Retry-After", r)

    def test_successful_logins_do_not_use_up_the_limit(self):
        for _ in range(throttles.LOGIN_LIMIT_PER_USER + 5):
            self.assertEqual(self.succeed().status_code, 200)

    def test_ip_limit_applies_across_usernames(self):
        for i in range(throttles.LOGIN_LIMIT_PER_IP):
            self.assertEqual(self.fail(username=f"nobody{i}").status_code, 400)
        r = self.fail(username="nobody_else")
        self.assertEqual(r.status_code, 429)

    def test_cloudflare_header_is_used_from_trusted_proxy(self):
        for _ in range(throttles.LOGIN_LIMIT_PER_USER):
            self.fail(ip="127.0.0.1", HTTP_CF_CONNECTING_IP="203.0.113.5")
        # Same proxy, different real client: not limited by the first client's count.
        ok = self.fail(
            username="nobody_b", ip="127.0.0.1", HTTP_CF_CONNECTING_IP="203.0.113.6"
        )
        self.assertEqual(ok.status_code, 400)

    def test_signup_limited_after_five_attempts_from_one_ip(self):
        for _ in range(throttles.SIGNUP_LIMIT_PER_IP):
            r = self.client.post(SIGNUP, {}, format="json", REMOTE_ADDR="10.0.0.2")
            self.assertEqual(r.status_code, 400)
        r = self.client.post(SIGNUP, {}, format="json", REMOTE_ADDR="10.0.0.2")
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.json()["message"], throttles.SIGNUP_MESSAGE)

    def test_login_fails_open_when_cache_is_down(self):
        broken = mock.Mock()
        broken.get.side_effect = ConnectionError("redis down")
        broken.add.side_effect = ConnectionError("redis down")
        broken.incr.side_effect = ConnectionError("redis down")
        with mock.patch("app.throttles.cache", broken):
            self.assertEqual(self.succeed().status_code, 200)
            self.assertEqual(self.fail().status_code, 400)


class ClientIpTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_untrusted_source_cannot_spoof_cloudflare_header(self):
        req = self.factory.post(
            LOGIN, REMOTE_ADDR="198.51.100.9", HTTP_CF_CONNECTING_IP="1.2.3.4"
        )
        self.assertEqual(throttles.client_ip(req), "198.51.100.9")

    def test_trusted_proxy_uses_cloudflare_header(self):
        req = self.factory.post(
            LOGIN, REMOTE_ADDR="127.0.0.1", HTTP_CF_CONNECTING_IP="1.2.3.4"
        )
        self.assertEqual(throttles.client_ip(req), "1.2.3.4")

    def test_trusted_proxy_without_header_falls_back_to_remote(self):
        req = self.factory.post(LOGIN, REMOTE_ADDR="127.0.0.1")
        self.assertEqual(throttles.client_ip(req), "127.0.0.1")
