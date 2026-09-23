"""ProgressClock completion, soft-dismiss, and sheet sync guards."""
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    Heritage,
    ProgressClock,
    Session,
    Vice,
)


class ProgressClockCompletionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="comp_u", password="x")
        self.gm = User.objects.create_user(username="comp_gm", password="x")
        self.heritage = Heritage.objects.create(
            name="HumanComp", base_hp=0, description=""
        )
        self.vice = Vice.objects.create(name="VComp", description="")
        self.campaign = Campaign.objects.create(name="Comp Camp", gm=self.gm)
        self.campaign.players.add(self.user)
        self.session = Session.objects.create(
            campaign=self.campaign, name="S1"
        )
        self.campaign.active_session = self.session
        self.campaign.save(update_fields=["active_session"])
        dots = {
            k: 0
            for k in (
                "hunt",
                "study",
                "survey",
                "tinker",
                "finesse",
                "prowl",
                "skirmish",
                "wreck",
                "bizarre",
                "command",
                "consort",
                "sway",
            )
        }
        self.char = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name="Comp Tester",
            heritage=self.heritage,
            vice=self.vice,
            playbook="STAND",
            action_dots=dots,
            coin_stats={
                "power": "D",
                "speed": "D",
                "range": "D",
                "durability": "D",
                "precision": "D",
                "development": "D",
            },
        )
        self.client.force_authenticate(user=self.user)

    def test_fill_sets_completed_and_session(self):
        clock = ProgressClock.objects.create(
            name="Heat",
            clock_type="COUNTDOWN",
            max_segments=4,
            filled_segments=3,
            character=self.char,
            campaign=self.campaign,
            created_by=self.user,
        )
        self.assertFalse(clock.completed)
        clock.filled_segments = 4
        clock.save(update_fields=["filled_segments"])
        clock.refresh_from_db()
        self.assertTrue(clock.completed)
        self.assertIsNotNone(clock.completed_at)
        self.assertEqual(clock.completed_session_id, self.session.id)

    def test_unfill_clears_completion_keeps_dismissed(self):
        clock = ProgressClock.objects.create(
            name="Heat",
            clock_type="COUNTDOWN",
            max_segments=4,
            filled_segments=4,
            character=self.char,
            campaign=self.campaign,
            created_by=self.user,
            completed=True,
            completed_at=timezone.now(),
            completed_session=self.session,
            dismissed_at=timezone.now(),
        )
        clock.filled_segments = 2
        clock.save(update_fields=["filled_segments"])
        clock.refresh_from_db()
        self.assertFalse(clock.completed)
        self.assertIsNone(clock.completed_at)
        self.assertIsNone(clock.completed_session_id)
        self.assertIsNotNone(clock.dismissed_at)

    def test_update_fields_persists_completion(self):
        clock = ProgressClock.objects.create(
            name="Heat",
            clock_type="COUNTDOWN",
            max_segments=4,
            filled_segments=3,
            character=self.char,
            campaign=self.campaign,
            created_by=self.user,
        )
        clock.filled_segments = 4
        clock.save(update_fields=["filled_segments"])
        clock.refresh_from_db()
        self.assertTrue(clock.completed)

    def test_dismiss_action_and_sync_survives(self):
        clock = ProgressClock.objects.create(
            name="Heat",
            clock_type="COUNTDOWN",
            max_segments=4,
            filled_segments=4,
            character=self.char,
            campaign=self.campaign,
            created_by=self.user,
        )
        clock.save()  # derive completed
        clock.refresh_from_db()
        self.assertTrue(clock.completed)
        res = self.client.post(f"/api/progress-clocks/{clock.id}/dismiss/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        clock.refresh_from_db()
        self.assertIsNotNone(clock.dismissed_at)

        # Sheet PUT omits dismissed clock — must not hard-delete.
        res = self.client.patch(
            f"/api/characters/{self.char.id}/",
            {"progress_clocks": []},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        self.assertTrue(ProgressClock.objects.filter(id=clock.id).exists())

        # Character read excludes dismissed.
        res = self.client.get(f"/api/characters/{self.char.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [c["id"] for c in res.data.get("progress_clocks") or []]
        self.assertNotIn(clock.id, ids)

    def test_completed_clock_not_deleted_via_sync_omission(self):
        clock = ProgressClock.objects.create(
            name="Heat",
            clock_type="COUNTDOWN",
            max_segments=4,
            filled_segments=4,
            character=self.char,
            campaign=self.campaign,
            created_by=self.user,
        )
        clock.save()
        clock.refresh_from_db()
        self.assertTrue(clock.completed)
        res = self.client.patch(
            f"/api/characters/{self.char.id}/",
            {"progress_clocks": []},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        self.assertTrue(ProgressClock.objects.filter(id=clock.id).exists())

    def test_client_cannot_write_completed(self):
        clock = ProgressClock.objects.create(
            name="Heat",
            clock_type="COUNTDOWN",
            max_segments=4,
            filled_segments=1,
            character=self.char,
            campaign=self.campaign,
            created_by=self.user,
        )
        res = self.client.patch(
            f"/api/progress-clocks/{clock.id}/",
            {"completed": True, "filled_segments": 1},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        clock.refresh_from_db()
        self.assertFalse(clock.completed)

    def test_completed_query_filter(self):
        clock = ProgressClock.objects.create(
            name="Heat",
            clock_type="COUNTDOWN",
            max_segments=4,
            filled_segments=4,
            character=self.char,
            campaign=self.campaign,
            created_by=self.user,
        )
        clock.save()
        self.client.force_authenticate(user=self.gm)
        res = self.client.get(
            "/api/progress-clocks/",
            {"campaign": self.campaign.id, "completed": 1, "include_dismissed": 1},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        results = res.data if isinstance(res.data, list) else res.data.get("results", [])
        ids = [c["id"] for c in results]
        self.assertIn(clock.id, ids)

    def test_recomplete_across_sessions_fresh_timestamp(self):
        s2 = Session.objects.create(
            campaign=self.campaign, name="S2"
        )
        clock = ProgressClock.objects.create(
            name="Heat",
            clock_type="COUNTDOWN",
            max_segments=4,
            filled_segments=4,
            character=self.char,
            campaign=self.campaign,
            created_by=self.user,
        )
        clock.save(active_session=self.session)
        clock.refresh_from_db()
        first_at = clock.completed_at
        self.assertEqual(clock.completed_session_id, self.session.id)
        clock.filled_segments = 2
        clock.save(update_fields=["filled_segments"])
        clock.refresh_from_db()
        self.assertFalse(clock.completed)
        self.campaign.active_session = s2
        self.campaign.save(update_fields=["active_session"])
        clock.filled_segments = 4
        clock.save(update_fields=["filled_segments"], active_session=s2)
        clock.refresh_from_db()
        self.assertTrue(clock.completed)
        self.assertEqual(clock.completed_session_id, s2.id)
        self.assertIsNotNone(clock.completed_at)
        self.assertGreaterEqual(clock.completed_at, first_at)
