"""Tests for fillable character/NPC sheet PDF export."""

import io

from django.contrib.auth.models import User
from django.test import TestCase
from pypdf import PdfReader
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Heritage, NPC
from characters.services.sheet_export import export_npc_pdf, export_pc_pdf
from characters.services.sheet_export.pc_builder import build_pc_field_values
from characters.services.sheet_export.template_builder import ensure_templates


class SheetExportServiceTests(TestCase):
    def setUp(self):
        self.heritage = Heritage.objects.create(name="Human", base_hp=0, description="")
        self.user = User.objects.create_user(username="pcowner", password="testpass123")
        self.character = Character.objects.create(
            user=self.user,
            true_name="Jotaro Kujo",
            stand_name="Star Platinum",
            heritage=self.heritage,
            appearance="Tall, hat",
            background_note="Student",
            background_note2="Sheet notes here",
            action_dots={
                "hunt": 2,
                "study": 1,
                "survey": 0,
                "tinker": 0,
                "finesse": 1,
                "prowl": 0,
                "skirmish": 2,
                "wreck": 0,
                "attune": 1,
                "command": 0,
                "consort": 0,
                "sway": 0,
            },
            stress=3,
            coin_boxes=[True, True, False, False],
            xp_clocks={"insight": 2, "prowess": 1, "resolve": 0, "heritage": 0, "playbook": 0},
        )

    def test_templates_exist(self):
        pc_path, npc_path = ensure_templates()
        self.assertTrue(pc_path.exists())
        self.assertTrue(npc_path.exists())

    def test_pc_export_returns_pdf_bytes(self):
        pdf_bytes, filename = export_pc_pdf(self.character)
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))
        self.assertIn("Jotaro-Kujo", filename)

    def test_pc_field_values_include_identity(self):
        values = build_pc_field_values(self.character)
        self.assertEqual(values["pc_name"], "Jotaro Kujo")
        self.assertEqual(values["pc_stand_name"], "Star Platinum")
        self.assertEqual(values["pc_action_hunt"], "2")
        self.assertEqual(values["pc_notes"], "Sheet notes here")

    def test_filled_pdf_contains_character_name(self):
        pdf_bytes, _ = export_pc_pdf(self.character)
        reader = PdfReader(io.BytesIO(pdf_bytes))
        fields = reader.get_fields() or {}
        self.assertIn("pc_name", fields)
        self.assertEqual(fields["pc_name"].get("/V"), "Jotaro Kujo")


class SheetExportAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.heritage = Heritage.objects.create(name="Human", base_hp=0, description="")
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.other = User.objects.create_user(username="other", password="testpass123")
        self.gm = User.objects.create_user(username="gm", password="testpass123")
        self.campaign = Campaign.objects.create(name="Test Campaign", gm=self.gm)
        self.character = Character.objects.create(
            user=self.owner,
            campaign=self.campaign,
            true_name="Export Me",
            heritage=self.heritage,
        )
        self.npc = NPC.objects.create(
            creator=self.gm,
            campaign=self.campaign,
            name="Dio Brando",
            stand_name="The World",
        )

    def test_owner_can_export_pc_pdf(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(f"/api/characters/{self.character.id}/export-pdf/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))
        self.assertIn("attachment", response["Content-Disposition"])

    def test_gm_can_export_campaign_pc_pdf(self):
        self.client.force_authenticate(user=self.gm)
        response = self.client.get(f"/api/characters/{self.character.id}/export-pdf/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_unrelated_user_cannot_export_pc_pdf(self):
        self.client.force_authenticate(user=self.other)
        response = self.client.get(f"/api/characters/{self.character.id}/export-pdf/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_gm_can_export_npc_pdf(self):
        self.client.force_authenticate(user=self.gm)
        response = self.client.get(f"/api/npcs/{self.npc.id}/export-pdf/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_unrelated_user_cannot_export_npc_pdf(self):
        self.client.force_authenticate(user=self.other)
        response = self.client.get(f"/api/npcs/{self.npc.id}/export-pdf/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_npc_export_service_smoke(self):
        pdf_bytes, filename = export_npc_pdf(self.npc)
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))
        self.assertIn("Dio-Brando", filename)
