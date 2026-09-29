"""POST /api/user-profiles/change-password/ — authenticated password change."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import UserProfile


class ChangePasswordTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="pw_change_user",
            password="OldPass123!",
        )
        UserProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = "/api/user-profiles/change-password/"

    def test_change_password_success(self):
        response = self.client.post(
            self.url,
            {
                "old_password": "OldPass123!",
                "new_password": "NewPass456!",
                "confirm_password": "NewPass456!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data.get("message"), "Password updated successfully")
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPass456!"))
        self.assertFalse(self.user.check_password("OldPass123!"))

    def test_rejects_wrong_current_password(self):
        response = self.client.post(
            self.url,
            {
                "old_password": "WrongPass!",
                "new_password": "NewPass456!",
                "confirm_password": "NewPass456!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("old_password", response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPass123!"))

    def test_rejects_mismatched_confirm_password(self):
        response = self.client.post(
            self.url,
            {
                "old_password": "OldPass123!",
                "new_password": "NewPass456!",
                "confirm_password": "Different456!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("confirm_password", response.data)

    def test_rejects_same_as_current_password(self):
        response = self.client.post(
            self.url,
            {
                "old_password": "OldPass123!",
                "new_password": "OldPass123!",
                "confirm_password": "OldPass123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data)

    def test_rejects_too_short_new_password(self):
        response = self.client.post(
            self.url,
            {
                "old_password": "OldPass123!",
                "new_password": "abc",
                "confirm_password": "abc",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            self.url,
            {
                "old_password": "OldPass123!",
                "new_password": "NewPass456!",
                "confirm_password": "NewPass456!",
            },
            format="json",
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
