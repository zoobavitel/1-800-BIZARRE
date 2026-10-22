"""Own uploaded-media URLs must stay file references, never host-pinned image_url."""

import importlib

from django.apps import apps as django_apps
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from characters.media_urls import media_name_from_url
from characters.models import NPC, Campaign

_PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
    b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)
OLD_HOST = "https://bizarre-api.tailb65341.ts.net"
MEDIA_ROOT = "/tmp/bizarre_test_media_own_urls"


class MediaNameFromUrlTests(SimpleTestCase):
    hosts = {"bizarre-api.tailb65341.ts.net", "api.1-800-bizarre.com"}

    def test_own_host_media_url(self):
        self.assertEqual(
            media_name_from_url(f"{OLD_HOST}/media/npc_images/a%20b.webp", self.hosts),
            "npc_images/a b.webp",
        )

    def test_external_host_is_not_own(self):
        self.assertIsNone(
            media_name_from_url("https://cdn.example.org/media/x.png", self.hosts)
        )

    def test_non_media_path_and_traversal(self):
        self.assertIsNone(media_name_from_url(f"{OLD_HOST}/api/x.png", self.hosts))
        self.assertIsNone(
            media_name_from_url(f"{OLD_HOST}/media/../secret", self.hosts)
        )
        self.assertIsNone(media_name_from_url("", self.hosts))


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class OwnMediaUrlSerializerTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="own_media_gm", password="pw")
        self.campaign = Campaign.objects.create(name="Own Media", gm=self.user)
        self.npc = NPC.objects.create(
            name="Bob", creator=self.user, campaign=self.campaign
        )
        self.npc.image.save(
            "penguin.png",
            SimpleUploadedFile("penguin.png", _PNG_1X1, content_type="image/png"),
            save=True,
        )
        self.file_name = self.npc.image.name
        self.client.force_authenticate(user=self.user)

    def test_echoed_own_media_url_keeps_the_file(self):
        """The bug: autosave sent the file URL back as image_url with image=null."""
        response = self.client.patch(
            f"/api/npcs/{self.npc.id}/",
            {"image": None, "image_url": f"{OLD_HOST}/media/{self.file_name}"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.npc.refresh_from_db()
        self.assertEqual(self.npc.image.name, self.file_name)
        self.assertEqual(self.npc.image_url, "")

    def test_external_url_still_replaces_the_file(self):
        response = self.client.patch(
            f"/api/npcs/{self.npc.id}/",
            {"image_url": "https://example.com/other.png"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.npc.refresh_from_db()
        self.assertEqual(self.npc.image_url, "https://example.com/other.png")
        self.assertFalse(bool(self.npc.image))

    def test_own_host_url_for_missing_file_is_kept_as_link(self):
        url = f"{OLD_HOST}/media/npc_images/does-not-exist.png"
        response = self.client.patch(
            f"/api/npcs/{self.npc.id}/", {"image_url": url}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.npc.refresh_from_db()
        self.assertEqual(self.npc.image_url, url)


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class UnpinMigrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="own_media_mig", password="pw")
        self.campaign = Campaign.objects.create(name="Mig", gm=self.user)
        holder = NPC.objects.create(name="Holder", creator=self.user)
        holder.image.save(
            "pinned.png",
            SimpleUploadedFile("pinned.png", _PNG_1X1, content_type="image/png"),
            save=True,
        )
        self.file_name = holder.image.name
        holder.delete()
        self.pinned = NPC.objects.create(
            name="Pinned",
            creator=self.user,
            campaign=self.campaign,
            image_url=f"{OLD_HOST}/media/{self.file_name}",
        )
        self.external = NPC.objects.create(
            name="External",
            creator=self.user,
            image_url="https://example.com/keep.png",
        )
        self.migration = importlib.import_module(
            "characters.migrations.0130_unpin_own_media_urls"
        )

    def test_restores_file_and_clears_pinned_url(self):
        self.migration.unpin(django_apps, None)
        self.pinned.refresh_from_db()
        self.external.refresh_from_db()
        self.assertEqual(self.pinned.image.name, self.file_name)
        self.assertEqual(self.pinned.image_url, "")
        self.assertEqual(self.external.image_url, "https://example.com/keep.png")
        self.assertFalse(bool(self.external.image))
