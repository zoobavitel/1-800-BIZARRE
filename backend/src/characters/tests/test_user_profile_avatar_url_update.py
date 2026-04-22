"""PUT /api/user-profiles/update/ persists flat profile fields including avatar_url."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import UserProfile


class UserProfileAvatarUrlUpdateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="avatar_put_u", password="pw")
        UserProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_flat_put_persists_avatar_url(self):
        url = "https://example.com/avatar.png"
        response = self.client.put(
            "/api/user-profiles/update/",
            {"avatar_url": url, "theme": "dark"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data.get("avatar_url"), url)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.avatar_url, url)

    def test_rejects_non_https_avatar_url(self):
        response = self.client.put(
            "/api/user-profiles/update/",
            {"avatar_url": "http://example.com/a.png"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("avatar_url", response.data)
