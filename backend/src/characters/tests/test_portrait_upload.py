"""Portrait/avatar multipart upload, clear, and size/type validation."""
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Heritage, UserProfile


# Minimal valid 1x1 PNG
_PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
    b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


@override_settings(MEDIA_ROOT="/tmp/bizarre_test_media_portraits")
class CharacterPortraitUploadTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="portrait_pc_u", password="pw")
        self.heritage = Heritage.objects.create(name="Human", base_hp=0, description="")
        self.campaign = Campaign.objects.create(name="Portrait Camp", gm=self.user)
        self.character = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name="Jotaro",
            heritage=self.heritage,
            image_url="https://example.com/old.png",
        )
        self.client.force_authenticate(user=self.user)

    def test_multipart_upload_clears_image_url(self):
        upload = SimpleUploadedFile("face.png", _PNG_1X1, content_type="image/png")
        response = self.client.patch(
            f"/api/characters/{self.character.id}/",
            {"image": upload},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.character.refresh_from_db()
        self.assertTrue(bool(self.character.image))
        self.assertEqual(self.character.image_url, "")
        self.assertIn("character_images/", self.character.image.name)

    def test_npc_multipart_upload_works(self):
        from characters.models import NPC

        npc = NPC.objects.create(
            name="Enemy",
            creator=self.user,
            campaign=self.campaign,
            image_url="https://example.com/npc-old.png",
        )
        upload = SimpleUploadedFile("npc.png", _PNG_1X1, content_type="image/png")
        response = self.client.patch(
            f"/api/npcs/{npc.id}/",
            {"image": upload},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        npc.refresh_from_db()
        self.assertTrue(bool(npc.image))
        self.assertEqual(npc.image_url, "")

    def test_json_null_clears_image(self):
        self.character.image.save(
            "keep.png",
            SimpleUploadedFile("keep.png", _PNG_1X1, content_type="image/png"),
            save=True,
        )
        response = self.client.patch(
            f"/api/characters/{self.character.id}/",
            {"image": None, "image_url": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.character.refresh_from_db()
        self.assertFalse(bool(self.character.image))

    def test_new_https_url_clears_file(self):
        self.character.image.save(
            "oldfile.png",
            SimpleUploadedFile("oldfile.png", _PNG_1X1, content_type="image/png"),
            save=True,
        )
        self.character.image_url = ""
        self.character.save(update_fields=["image_url"])
        response = self.client.patch(
            f"/api/characters/{self.character.id}/",
            {"image_url": "https://example.com/new-portrait.png"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.character.refresh_from_db()
        self.assertEqual(
            self.character.image_url, "https://example.com/new-portrait.png"
        )
        self.assertFalse(bool(self.character.image))

    def test_rejects_oversized_upload(self):
        big = SimpleUploadedFile(
            "big.png",
            b"x" * (2 * 1024 * 1024 + 1),
            content_type="image/png",
        )
        response = self.client.patch(
            f"/api/characters/{self.character.id}/",
            {"image": big},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", response.data)

    def test_rejects_svg_upload(self):
        svg = SimpleUploadedFile(
            "x.svg",
            b'<svg xmlns="http://www.w3.org/2000/svg"></svg>',
            content_type="image/svg+xml",
        )
        response = self.client.patch(
            f"/api/characters/{self.character.id}/",
            {"image": svg},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", response.data)

    def test_rejects_http_image_url(self):
        response = self.client.patch(
            f"/api/characters/{self.character.id}/",
            {"image_url": "http://example.com/a.png"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image_url", response.data)


@override_settings(MEDIA_ROOT="/tmp/bizarre_test_media_portraits")
class UserProfileAvatarUploadTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="avatar_up_u", password="pw")
        UserProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_multipart_avatar_upload(self):
        upload = SimpleUploadedFile("me.png", _PNG_1X1, content_type="image/png")
        response = self.client.put(
            "/api/user-profiles/update/",
            {"avatar": upload, "theme": "dark"},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.user.profile.refresh_from_db()
        self.assertTrue(bool(self.user.profile.avatar))
        self.assertEqual(self.user.profile.avatar_url, "")
        self.assertIn("avatars/", self.user.profile.avatar.name)

    def test_json_null_clears_avatar(self):
        self.user.profile.avatar.save(
            "old.png",
            SimpleUploadedFile("old.png", _PNG_1X1, content_type="image/png"),
            save=True,
        )
        response = self.client.put(
            "/api/user-profiles/update/",
            {"avatar": None, "avatar_url": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.user.profile.refresh_from_db()
        self.assertFalse(bool(self.user.profile.avatar))

    def test_new_avatar_url_clears_file(self):
        self.user.profile.avatar.save(
            "old.png",
            SimpleUploadedFile("old.png", _PNG_1X1, content_type="image/png"),
            save=True,
        )
        response = self.client.put(
            "/api/user-profiles/update/",
            {"avatar_url": "https://example.com/avatar.png"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.avatar_url, "https://example.com/avatar.png")
        self.assertFalse(bool(self.user.profile.avatar))
