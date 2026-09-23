"""Downtime Train endpoint: 1/2 XP, once per track per phase, no heritage."""

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from characters.models import (
    Campaign,
    Character,
    Crew,
    DowntimeActivity,
    ExperienceTracker,
    Heritage,
    Session,
)


class DowntimeTrainTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.player = User.objects.create_user(username="pc", password="pass")
        self.gm = User.objects.create_user(username="gm", password="pass")
        self.heritage = Heritage.objects.create(
            name="Human", base_hp=0, description="Test"
        )
        self.campaign = Campaign.objects.create(
            name="Camp", gm=self.gm, description="Test"
        )
        self.crew = Crew.objects.create(
            name="Crew",
            campaign=self.campaign,
            upgrade_progress={},
        )
        self.character = Character.objects.create(
            user=self.player,
            true_name="Train PC",
            heritage=self.heritage,
            campaign=self.campaign,
            crew=self.crew,
            xp_clocks={
                "insight": 0,
                "prowess": 0,
                "resolve": 0,
                "heritage": 0,
                "playbook": 0,
            },
        )

    def test_train_marks_one_xp(self):
        self.client.force_authenticate(user=self.player)
        res = self.client.post(
            f"/api/characters/{self.character.id}/train/",
            {"track": "insight"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertEqual(data["amount"], 1)
        self.assertEqual(data["track"], "insight")
        self.assertEqual(data["new_total"], 1)
        self.assertIn("insight", data["downtime_trained_tracks"])
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["insight"], 1)
        self.assertTrue(
            DowntimeActivity.objects.filter(
                character=self.character, activity_type="TRAIN"
            ).exists()
        )
        self.assertTrue(
            ExperienceTracker.objects.filter(
                character=self.character, clock_key="insight", revoked_at__isnull=True
            ).exists()
        )

    def test_train_two_xp_with_crew_upgrade(self):
        self.crew.upgrade_progress = {"training_insight": True}
        self.crew.save(update_fields=["upgrade_progress"])
        self.client.force_authenticate(user=self.player)
        res = self.client.post(
            f"/api/characters/{self.character.id}/train/",
            {"track": "insight"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["amount"], 2)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks["insight"], 2)

    def test_playbook_uses_personal_training_upgrade(self):
        self.crew.upgrade_progress = {"training_personal": True}
        self.crew.save(update_fields=["upgrade_progress"])
        self.client.force_authenticate(user=self.player)
        res = self.client.post(
            f"/api/characters/{self.character.id}/train/",
            {"track": "playbook"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["amount"], 2)

    def test_heritage_rejected(self):
        self.client.force_authenticate(user=self.player)
        res = self.client.post(
            f"/api/characters/{self.character.id}/train/",
            {"track": "heritage"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json().get("code"), "invalid_track")

    def test_once_per_track_per_phase(self):
        self.client.force_authenticate(user=self.player)
        first = self.client.post(
            f"/api/characters/{self.character.id}/train/",
            {"track": "prowess"},
            format="json",
        )
        self.assertEqual(first.status_code, 200, first.content)
        second = self.client.post(
            f"/api/characters/{self.character.id}/train/",
            {"track": "prowess"},
            format="json",
        )
        self.assertEqual(second.status_code, 400)
        self.assertEqual(second.json().get("code"), "already_trained")
        # Different track still ok
        other = self.client.post(
            f"/api/characters/{self.character.id}/train/",
            {"track": "resolve"},
            format="json",
        )
        self.assertEqual(other.status_code, 200, other.content)

    def test_phase_resets_after_completed_session(self):
        self.client.force_authenticate(user=self.player)
        first = self.client.post(
            f"/api/characters/{self.character.id}/train/",
            {"track": "insight"},
            format="json",
        )
        self.assertEqual(first.status_code, 200, first.content)
        Session.objects.create(
            campaign=self.campaign,
            name="Score done",
            status="COMPLETED",
            session_date=timezone.now() + timezone.timedelta(minutes=1),
        )
        again = self.client.post(
            f"/api/characters/{self.character.id}/train/",
            {"track": "insight"},
            format="json",
        )
        self.assertEqual(again.status_code, 200, again.content)

    def test_fill_mints_pending(self):
        self.character.xp_clocks = {
            "insight": 4,
            "prowess": 0,
            "resolve": 0,
            "heritage": 0,
            "playbook": 0,
        }
        self.character.save(update_fields=["xp_clocks"])
        self.client.force_authenticate(user=self.player)
        res = self.client.post(
            f"/api/characters/{self.character.id}/train/",
            {"track": "insight"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertEqual(data["new_total"], 0)
        self.assertGreaterEqual(data["pendings_minted"], 1)
