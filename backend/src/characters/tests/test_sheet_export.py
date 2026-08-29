"""Tests for fillable character/NPC sheet PDF export."""

import io

from django.contrib.auth.models import User
from django.test import TestCase
from pypdf import PdfReader
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Heritage, NPC
from characters.services.sheet_export import export_npc_pdf, export_pc_pdf
from characters.services.sheet_export.pc_builder import (
    CHECKBOX_OFF,
    CHECKBOX_ON,
    build_pc_field_values,
)
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

    def test_pc_export_human_readable_labels(self):
        from characters.models import Ability, Stand, StandAbility, Vice

        vice = Vice.objects.create(name="Obligation", description="")
        self.character.playbook = "STAND"
        self.character.alias = "JoJo"
        self.character.level = 3
        self.character.playbook_xp_archetypes = ["PHENOMENA", "SHARED"]
        self.character.vice = vice
        self.character.vice_details = "Family debt"
        self.character.close_friend = "Avdol"
        self.character.rival = "Dio"
        self.character.inventory = {
            "items": [
                {"name": "Hat", "quantity": 1, "notes": "lucky"},
                {"name": "Photos", "qty": 3},
            ]
        }
        self.character.reputation_status = {"Speedwagon Foundation": 2, "DIO": -2}
        self.character.save()
        stand = Stand.objects.create(
            character=self.character,
            name="Star Platinum",
            type="PHENOMENA",
            type_custom="Weather Stand",
            form="Humanoid",
            forms=["Phenomenon", "Mist-form"],
            consciousness_level="A",
            power="A",
            speed="A",
            range="C",
            durability="A",
            precision="A",
            development="C",
            armor=0,
        )
        StandAbility.objects.create(
            stand=stand, name="Ora Rush", description="Barrage of punches"
        )
        ability = Ability.objects.create(
            name="Guardian Angel",
            type="standard",
            description="Protect an ally once per score",
        )
        self.character.standard_abilities.add(ability)

        values = build_pc_field_values(self.character)
        self.assertEqual(values["pc_playbook"], "Stand")
        self.assertEqual(values["pc_alias"], "JoJo")
        self.assertEqual(values["pc_level"], "3")
        self.assertIn("Phenomena", values["pc_playbook_archetypes"])
        self.assertIn("Shared", values["pc_playbook_archetypes"])
        self.assertNotIn("PHENOMENA", values["pc_playbook_archetypes"])
        self.assertEqual(values["pc_stand_type"], "Phenomena")
        self.assertEqual(values["pc_stand_type_custom"], "Weather Stand")
        self.assertEqual(values["pc_stand_forms"], "Phenomenon, Mist-form")
        self.assertEqual(values["pc_stand_consciousness"], "A")
        self.assertIn("Obligation — Family debt", values["pc_vice"])
        self.assertEqual(values["pc_close_friend"], "Avdol")
        self.assertEqual(values["pc_rival"], "Dio")
        self.assertIn("Hat", values["pc_inventory"])
        self.assertIn("lucky", values["pc_inventory"])
        self.assertNotIn("{", values["pc_inventory"])
        self.assertIn("Speedwagon Foundation: 2", values["pc_reputation"])
        self.assertIn("[Stand unique] Ora Rush", values["pc_abilities"])
        self.assertIn("[Standard] Guardian Angel", values["pc_abilities"])
        self.assertEqual(values["pc_armor_stand"], "0/5")  # Durability A → 5

        pdf_bytes, _ = export_pc_pdf(self.character)
        fields = PdfReader(io.BytesIO(pdf_bytes)).get_fields() or {}
        self.assertIn("pc_stand_forms", fields)
        self.assertIn("pc_reputation", fields)
        self.assertEqual(fields["pc_playbook"].get("/V"), "Stand")
        self.assertEqual(fields["pc_stand_forms"].get("/V"), "Phenomenon, Mist-form")

    def test_spin_armor_exports_when_spin_playbook(self):
        self.character.playbook = "SPIN"
        self.character.spin_armor_used = 1
        self.character.save(update_fields=["playbook", "spin_armor_used"])
        values = build_pc_field_values(self.character)
        self.assertEqual(values["pc_playbook"], "Spin")
        self.assertEqual(values["pc_armor_spin"], "1/3")
        self.assertEqual(values["pc_armor_hamon"], "")

    def test_filled_pdf_contains_character_name(self):
        pdf_bytes, _ = export_pc_pdf(self.character)
        reader = PdfReader(io.BytesIO(pdf_bytes))
        fields = reader.get_fields() or {}
        self.assertIn("pc_name", fields)
        self.assertEqual(fields["pc_name"].get("/V"), "Jotaro Kujo")

    def test_stress_track_exports_nine_boxes(self):
        self.character.stress = 4
        self.character.save(update_fields=["stress"])

        values = build_pc_field_values(self.character)
        for i in range(9):
            expected = CHECKBOX_ON if i < 4 else CHECKBOX_OFF
            self.assertEqual(values[f"pc_stress_{i}"], expected)
        self.assertNotIn("pc_stress_9", values)

        pdf_bytes, _ = export_pc_pdf(self.character)
        fields = PdfReader(io.BytesIO(pdf_bytes)).get_fields() or {}
        self.assertIn("pc_stress_8", fields)
        self.assertNotIn("pc_stress_9", fields)

    def test_healing_clock_exports_four_segments(self):
        self.character.healing_clock_filled = 3
        self.character.healing_clock_segments = 4
        self.character.save(
            update_fields=["healing_clock_filled", "healing_clock_segments"]
        )

        values = build_pc_field_values(self.character)
        for i in range(4):
            expected = CHECKBOX_ON if i < 3 else CHECKBOX_OFF
            self.assertEqual(values[f"pc_healing_{i}"], expected)
        # Only emit filled keys for the character's clock length
        self.assertNotIn("pc_healing_4", values)

        pdf_bytes, _ = export_pc_pdf(self.character)
        fields = PdfReader(io.BytesIO(pdf_bytes)).get_fields() or {}
        # Template always has 5 slots (Slower Recovery); unused stay Off
        self.assertIn("pc_healing_3", fields)
        self.assertIn("pc_healing_4", fields)
        self.assertEqual(fields["pc_healing_4"].get("/V"), "/Off")

    def test_playbook_xp_track_exports_ten_marks(self):
        self.character.xp_clocks = {
            "insight": 8,
            "prowess": 3,
            "resolve": 0,
            "heritage": 0,
            "playbook": 10,
        }
        self.character.save(update_fields=["xp_clocks"])

        values = build_pc_field_values(self.character)
        for i in range(8):
            self.assertEqual(values[f"pc_xp_insight_{i}"], CHECKBOX_ON)
        self.assertNotIn("pc_xp_insight_8", values)
        for i in range(10):
            self.assertEqual(values[f"pc_xp_playbook_{i}"], CHECKBOX_ON)

        pdf_bytes, _ = export_pc_pdf(self.character)
        fields = PdfReader(io.BytesIO(pdf_bytes)).get_fields() or {}
        self.assertIn("pc_xp_playbook_9", fields)
        self.assertNotIn("pc_xp_insight_8", fields)
        self.assertEqual(fields["pc_xp_playbook_9"].get("/V"), "/Yes")


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
