"""Campaign.image multipart upload / clear / reject tests."""
import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Faction, Heritage

# Minimal valid 1x1 PNG
_PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="test_media_"))
class CampaignImageUploadTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user("cimg_gm", "cimg_gm@test.com", "pw")
        self.player = User.objects.create_user("cimg_pl", "cimg_pl@test.com", "pw")
        self.campaign = Campaign.objects.create(name="Photo Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        self.url = f"/api/campaigns/{self.campaign.id}/"

    def test_gm_multipart_patch_sets_image(self):
        self.client.force_authenticate(self.gm)
        upload = SimpleUploadedFile(
            "camp.png", _PNG_1X1, content_type="image/png"
        )
        r = self.client.patch(self.url, {"image": upload}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.campaign.refresh_from_db()
        self.assertTrue(bool(self.campaign.image))
        self.assertIn("campaign_images/", self.campaign.image.name)

    def test_non_gm_multipart_patch_403(self):
        self.client.force_authenticate(self.player)
        upload = SimpleUploadedFile(
            "camp.png", _PNG_1X1, content_type="image/png"
        )
        r = self.client.patch(self.url, {"image": upload}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.campaign.refresh_from_db()
        self.assertFalse(bool(self.campaign.image))

    def test_clear_image_with_empty_string(self):
        self.client.force_authenticate(self.gm)
        self.campaign.image.save(
            "seed.png",
            SimpleUploadedFile("seed.png", _PNG_1X1, content_type="image/png"),
            save=True,
        )
        r = self.client.patch(self.url, {"image": ""}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.campaign.refresh_from_db()
        self.assertFalse(bool(self.campaign.image))

    def test_clear_image_with_json_null(self):
        self.client.force_authenticate(self.gm)
        self.campaign.image.save(
            "seed2.png",
            SimpleUploadedFile("seed2.png", _PNG_1X1, content_type="image/png"),
            save=True,
        )
        r = self.client.patch(self.url, {"image": None}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.campaign.refresh_from_db()
        self.assertFalse(bool(self.campaign.image))

    def test_svg_rejected(self):
        self.client.force_authenticate(self.gm)
        upload = SimpleUploadedFile(
            "evil.svg",
            b'<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>',
            content_type="image/svg+xml",
        )
        r = self.client.patch(self.url, {"image": upload}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.campaign.refresh_from_db()
        self.assertFalse(bool(self.campaign.image))


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="test_media_faction_"))
class FactionImagePatchTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user("fimg_gm", "fimg_gm@test.com", "pw")
        self.player = User.objects.create_user("fimg_pl", "fimg_pl@test.com", "pw")
        self.campaign = Campaign.objects.create(name="F Photo", gm=self.gm)
        self.campaign.players.add(self.player)
        self.heritage = Heritage.objects.create(
            name="Human", base_hp=0, description=""
        )
        Character.objects.create(
            user=self.player,
            campaign=self.campaign,
            true_name="PC",
            heritage=self.heritage,
        )
        self.faction = Faction.objects.create(
            name="Canaries", campaign=self.campaign
        )
        self.url = f"/api/factions/{self.faction.id}/"

    def test_gm_multipart_patch_sets_image(self):
        self.client.force_authenticate(self.gm)
        upload = SimpleUploadedFile(
            "fac.png", _PNG_1X1, content_type="image/png"
        )
        r = self.client.patch(
            self.url,
            {"name": "Canaries", "image": upload},
            format="multipart",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.faction.refresh_from_db()
        self.assertTrue(bool(self.faction.image))

    def test_non_gm_patch_403(self):
        self.client.force_authenticate(self.player)
        upload = SimpleUploadedFile(
            "fac.png", _PNG_1X1, content_type="image/png"
        )
        r = self.client.patch(self.url, {"image": upload}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
