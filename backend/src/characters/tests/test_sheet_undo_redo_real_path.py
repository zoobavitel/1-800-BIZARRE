"""Sheet undo and redo after a real PATCH, not a hand-made history row.

Two bugs on prod (found 2026-10-26):
- Undo after filling a blank text field (rival, close friend) returned 500:
  the blank old value came back as None for a NOT NULL text column.
- Redo returned 500 after any real save: history rows recorded
  "version" with the unevaluated F() expression as its new value.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, CharacterHistory, Heritage


class SheetUndoRedoRealPathTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="undo_owner", password="pw-undo-owner-1")
        gm = User.objects.create_user(username="undo_gm", password="pw-undo-gm-1")
        campaign = Campaign.objects.create(name="Undo Camp", gm=gm)
        campaign.players.add(self.owner)
        heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        self.pc = Character.objects.create(
            user=self.owner, campaign=campaign, true_name="Undo PC",
            heritage=heritage, rival="", stress=0,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.base = f"/api/characters/{self.pc.id}"

    def patch(self, body):
        response = self.client.patch(f"{self.base}/", body, format="json")
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))

    def post(self, path):
        return self.client.post(f"{self.base}/{path}/", {}, format="json")

    def test_undo_after_filling_a_blank_text_field(self):
        self.patch({"rival": "Real Rival"})
        response = self.post("undo-latest-sheet-edit")
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.rival, "")

    def test_redo_after_undoing_a_real_save(self):
        self.patch({"stress": 3})
        self.assertEqual(self.post("undo-latest-sheet-edit").status_code, 200)
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.stress, 0)
        response = self.post("redo-latest-sheet-edit")
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.stress, 3)

    def test_history_does_not_record_the_version_counter(self):
        self.patch({"rival": "Someone"})
        entry = CharacterHistory.objects.filter(character=self.pc).order_by("-id").first()
        self.assertIsNotNone(entry)
        self.assertIn("rival", entry.changed_fields)
        self.assertNotIn("version", entry.changed_fields)

    def test_rows_already_holding_version_still_undo_and_redo(self):
        # Rows written on prod before this fix carry the F() text.
        self.pc.stress = 2
        self.pc.save(update_fields=["stress"])
        CharacterHistory.objects.filter(character=self.pc).delete()
        CharacterHistory.objects.create(
            character=self.pc, editor=self.owner,
            changed_fields={
                "stress": {"old": "0", "new": "2"},
                "version": {"old": "3", "new": "F(version) + Value(1)"},
            },
        )
        status = self.client.get(f"{self.base}/sheet-undo-status/").json()
        self.assertEqual(status["summary"], "Sheet edit (stress)")
        self.assertEqual(self.post("undo-latest-sheet-edit").status_code, 200)
        response = self.post("redo-latest-sheet-edit")
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.stress, 2)

    def test_rows_holding_only_version_are_not_offered_for_undo(self):
        CharacterHistory.objects.filter(character=self.pc).delete()
        CharacterHistory.objects.create(
            character=self.pc, editor=self.owner,
            changed_fields={"version": {"old": "3", "new": "F(version) + Value(1)"}},
        )
        status = self.client.get(f"{self.base}/sheet-undo-status/").json()
        self.assertFalse(status["available"])

    def test_history_api_hides_version_on_old_rows(self):
        CharacterHistory.objects.create(
            character=self.pc, editor=self.owner,
            changed_fields={
                "rival": {"old": "", "new": "X"},
                "version": {"old": "3", "new": "F(version) + Value(1)"},
            },
        )
        rows = self.client.get(f"/api/character-history/?character={self.pc.id}").json()
        rows = rows.get("results", rows) if isinstance(rows, dict) else rows
        self.assertTrue(rows)
        for row in rows:
            self.assertNotIn("version", row["changed_fields"])
