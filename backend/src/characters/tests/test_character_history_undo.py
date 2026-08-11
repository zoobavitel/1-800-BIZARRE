"""Tests for per-row character history undo and sheet XP delete guards."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    CharacterHistory,
    ExperienceTracker,
    Heritage,
    Session,
)
from characters.services.character_history_undo import (
    can_undo_character_history,
    experience_tracker_undoable_from_sheet,
    undo_character_history_entry,
)


class CharacterHistoryUndoTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="pc", password="pass")
        self.gm = User.objects.create_user(username="gm", password="pass")
        self.heritage = Heritage.objects.create(
            name="Human", base_hp=0, description="Test"
        )
        self.campaign = Campaign.objects.create(
            name="Camp", gm=self.gm, description="Test"
        )
        self.character = Character.objects.create(
            user=self.user,
            true_name="Undo PC",
            heritage=self.heritage,
            campaign=self.campaign,
            has_physical_armor_item=True,
            physical_armor_bonus_charges=2,
        )
        self.session = Session.objects.create(
            campaign=self.campaign,
            name="S1",
            status="ACTIVE",
        )

    def _history(self, changed_fields):
        return CharacterHistory.objects.create(
            character=self.character,
            editor=self.user,
            changed_fields=changed_fields,
        )

    def test_undo_simple_field_edit(self):
        entry = self._history(
            {
                "has_physical_armor_item": {"old": "False", "new": "True"},
                "physical_armor_bonus_charges": {"old": "0", "new": "2"},
            }
        )
        undo_character_history_entry(entry, user=self.user)
        self.character.refresh_from_db()
        entry.refresh_from_db()
        self.assertFalse(self.character.has_physical_armor_item)
        self.assertEqual(self.character.physical_armor_bonus_charges, 0)
        self.assertIsNotNone(entry.reverted_at)

    def test_undo_blocked_when_tracker_mirror_exists(self):
        now = timezone.now()
        entry = CharacterHistory.objects.create(
            character=self.character,
            editor=None,
            changed_fields={
                "xp_clocks": {
                    "old": '{"playbook": 0}',
                    "new": '{"playbook": 2}',
                }
            },
        )
        CharacterHistory.objects.filter(pk=entry.pk).update(timestamp=now)
        entry.refresh_from_db()
        ExperienceTracker.objects.create(
            character=self.character,
            session=self.session,
            trigger="BELIEFS",
            description="Session XP trigger: BELIEFS",
            xp_gained=2,
            award_source="GM",
            clock_key="playbook",
        )
        allowed, reason = can_undo_character_history(entry, self.user)
        self.assertFalse(allowed)
        self.assertIn("XP record", reason)


class ExperienceTrackerSheetUndoGuardTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="pc", password="pass")
        self.gm = User.objects.create_user(username="gm", password="pass")
        self.heritage = Heritage.objects.create(
            name="Human", base_hp=0, description="Test"
        )
        self.campaign = Campaign.objects.create(
            name="Camp", gm=self.gm, description="Test"
        )
        self.character = Character.objects.create(
            user=self.user,
            true_name="XP PC",
            heritage=self.heritage,
            campaign=self.campaign,
            xp_clocks={"playbook": 2},
        )
        self.session = Session.objects.create(
            campaign=self.campaign,
            name="S1",
            status="ACTIVE",
        )
        self.client = APIClient()

    def _tracker(self, award_source="GM"):
        return ExperienceTracker.objects.create(
            character=self.character,
            session=self.session,
            trigger="BELIEFS",
            description="Session XP trigger: BELIEFS",
            xp_gained=2,
            award_source=award_source,
            clock_key="playbook",
        )

    def test_player_cannot_delete_gm_award_from_sheet(self):
        entry = self._tracker("GM")
        self.client.force_authenticate(user=self.user)
        res = self.client.delete(f"/api/experience-tracker/{entry.id}/")
        self.assertEqual(res.status_code, 403)
        self.assertTrue(
            ExperienceTracker.objects.filter(pk=entry.id).exists()
        )

    def test_player_can_delete_self_toggle(self):
        entry = self._tracker("PLAYER")
        self.client.force_authenticate(user=self.user)
        res = self.client.delete(f"/api/experience-tracker/{entry.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(
            ExperienceTracker.objects.filter(pk=entry.id).exists()
        )

    def test_gm_can_delete_gm_award(self):
        entry = self._tracker("GM")
        self.client.force_authenticate(user=self.gm)
        res = self.client.delete(f"/api/experience-tracker/{entry.id}/")
        self.assertEqual(res.status_code, 204)

    def test_experience_tracker_undoable_helper(self):
        gm_entry = self._tracker("GM")
        player_entry = self._tracker("PLAYER")
        allowed_gm, _ = experience_tracker_undoable_from_sheet(gm_entry, self.user)
        allowed_player, _ = experience_tracker_undoable_from_sheet(
            player_entry, self.user
        )
        self.assertFalse(allowed_gm)
        self.assertTrue(allowed_player)


class GmUndoLatestChangeTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="gmundo", password="pass")
        self.player = User.objects.create_user(username="pcundo", password="pass")
        self.client = APIClient()
        self.heritage = Heritage.objects.create(
            name="Human", base_hp=0, description="Test"
        )
        self.campaign = Campaign.objects.create(
            name="Camp", gm=self.gm, description="Test"
        )
        self.character = Character.objects.create(
            user=self.player,
            true_name="GM Undo PC",
            heritage=self.heritage,
            campaign=self.campaign,
            has_physical_armor_item=True,
            physical_armor_bonus_charges=2,
        )

        self.session = Session.objects.create(
            campaign=self.campaign,
            name="S1",
            status="ACTIVE",
        )

    def test_gm_sheet_edit_uses_sheet_undo_not_gm_xp(self):
        """GM sheet field edits go through sheet-undo; GM XP row stays empty."""
        entry = CharacterHistory.objects.create(
            character=self.character,
            editor=self.gm,
            changed_fields={
                "has_physical_armor_item": {"old": "False", "new": "True"},
                "physical_armor_bonus_charges": {"old": "0", "new": "2"},
            },
        )
        self.client.force_authenticate(user=self.gm)
        gm_status = self.client.get(
            f"/api/characters/{self.character.id}/gm-undo-status/"
        )
        self.assertEqual(gm_status.status_code, 200)
        self.assertFalse(gm_status.json()["available"])

        sheet_status = self.client.get(
            f"/api/characters/{self.character.id}/sheet-undo-status/"
        )
        self.assertEqual(sheet_status.status_code, 200)
        self.assertTrue(sheet_status.json()["available"])

        undo_res = self.client.post(
            f"/api/characters/{self.character.id}/undo-latest-sheet-edit/",
            {},
            format="json",
        )
        self.assertEqual(undo_res.status_code, 200)
        self.character.refresh_from_db()
        entry.refresh_from_db()
        self.assertFalse(self.character.has_physical_armor_item)
        self.assertEqual(self.character.physical_armor_bonus_charges, 0)
        self.assertIsNotNone(entry.reverted_at)

        redo_status = self.client.get(
            f"/api/characters/{self.character.id}/sheet-redo-status/"
        )
        self.assertTrue(redo_status.json()["available"])
        redo_res = self.client.post(
            f"/api/characters/{self.character.id}/redo-latest-sheet-edit/",
            {},
            format="json",
        )
        self.assertEqual(redo_res.status_code, 200)
        self.character.refresh_from_db()
        entry.refresh_from_db()
        self.assertTrue(self.character.has_physical_armor_item)
        self.assertEqual(self.character.physical_armor_bonus_charges, 2)
        self.assertIsNone(entry.reverted_at)

    def test_player_sheet_edit_latest_undo_redo(self):
        self.character.stress = 1
        self.character.save(update_fields=["stress"])
        entry = CharacterHistory.objects.create(
            character=self.character,
            editor=self.player,
            changed_fields={"stress": {"old": "0", "new": "1"}},
        )
        self.client.force_authenticate(user=self.player)
        status_res = self.client.get(
            f"/api/characters/{self.character.id}/sheet-undo-status/"
        )
        self.assertEqual(status_res.status_code, 200)
        self.assertTrue(status_res.json()["available"])

        undo_res = self.client.post(
            f"/api/characters/{self.character.id}/undo-latest-sheet-edit/",
            {},
            format="json",
        )
        self.assertEqual(undo_res.status_code, 200)
        self.character.refresh_from_db()
        entry.refresh_from_db()
        self.assertEqual(self.character.stress, 0)
        self.assertIsNotNone(entry.reverted_at)

        redo_res = self.client.post(
            f"/api/characters/{self.character.id}/redo-latest-sheet-edit/",
            {},
            format="json",
        )
        self.assertEqual(redo_res.status_code, 200)
        self.character.refresh_from_db()
        self.assertEqual(self.character.stress, 1)

    def test_player_cannot_call_gm_undo(self):
        CharacterHistory.objects.create(
            character=self.character,
            editor=self.gm,
            changed_fields={
                "stress": {"old": "0", "new": "1"},
            },
        )
        self.client.force_authenticate(user=self.player)
        res = self.client.post(
            f"/api/characters/{self.character.id}/undo-latest-gm-change/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_gm_undo_manual_xp_award(self):
        self.character.xp_clocks = {"playbook": 1, "insight": 0, "prowess": 0,
                                   "resolve": 0, "heritage": 0}
        self.character.save()
        self.client.force_authenticate(user=self.gm)
        add_res = self.client.post(
            f"/api/characters/{self.character.id}/add-xp/",
            {"track": "playbook", "amount": 2, "reason": "GM test award"},
            format="json",
        )
        self.assertEqual(add_res.status_code, 200)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["playbook"], 3)

        undo_res = self.client.post(
            f"/api/characters/{self.character.id}/undo-latest-gm-change/",
            {},
            format="json",
        )
        self.assertEqual(undo_res.status_code, 200)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["playbook"], 1)
        self.assertEqual(
            ExperienceTracker.objects.filter(
                character=self.character, revoked_at__isnull=False
            ).count(),
            1,
        )

    def test_gm_add_manual_xp_to_free_pool(self):
        self.character.unallocated_xp = 0
        self.character.save(update_fields=["unallocated_xp"])
        self.client.force_authenticate(user=self.gm)
        add_res = self.client.post(
            f"/api/characters/{self.character.id}/add-xp/",
            {
                "track": "pool",
                "amount": 2,
                "reason": "GM manual pool test award",
            },
            format="json",
        )
        self.assertEqual(add_res.status_code, 200, add_res.content)

        self.character.refresh_from_db()
        self.assertEqual(self.character.unallocated_xp, 2)

        pool_tracker = ExperienceTracker.objects.filter(
            character=self.character, clock_key="pool", revoked_at__isnull=True
        ).first()
        self.assertIsNotNone(pool_tracker)
        self.assertEqual(pool_tracker.xp_gained, 2)

    def test_add_xp_with_session_id_does_not_500_for_playbook(self):
        self.character.xp_clocks = {
            "playbook": 0,
            "insight": 0,
            "prowess": 0,
            "resolve": 0,
            "heritage": 0,
        }
        self.character.save(update_fields=["xp_clocks"])
        self.client.force_authenticate(user=self.player)
        res = self.client.post(
            f"/api/characters/{self.character.id}/add-xp/",
            {
                "track": "playbook",
                "amount": 1,
                "reason": "Owner session test",
                "session_id": self.session.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook"), 1)

    def test_gm_redo_after_undo_manual_xp(self):
        self.character.xp_clocks = {
            "playbook": 1,
            "insight": 0,
            "prowess": 0,
            "resolve": 0,
            "heritage": 0,
        }
        self.character.save()
        self.client.force_authenticate(user=self.gm)
        self.client.post(
            f"/api/characters/{self.character.id}/add-xp/",
            {"track": "playbook", "amount": 2, "reason": "GM test award"},
            format="json",
        )
        self.client.post(
            f"/api/characters/{self.character.id}/undo-latest-gm-change/",
            {},
            format="json",
        )
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["playbook"], 1)

        redo_res = self.client.post(
            f"/api/characters/{self.character.id}/redo-latest-gm-change/",
            {},
            format="json",
        )
        self.assertEqual(redo_res.status_code, 200)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["playbook"], 3)
