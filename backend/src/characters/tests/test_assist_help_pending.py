"""Crew assist-help pending row: one per recipient per session; roll consumes prepaid stress once."""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from characters.models import AssistHelpPending, Campaign, Character, Crew, Heritage, Session


class AssistHelpPendingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm_ahp", password="pass")
        self.user_a = User.objects.create_user(username="actor_ahp", password="pass")
        self.user_h = User.objects.create_user(username="helper_ahp", password="pass")
        self.campaign = Campaign.objects.create(name="AssistHelp Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="AssistHelp Crew", campaign=self.campaign)
        self.hman, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "test"},
        )
        dots = {
            "hunt": 1,
            "study": 0,
            "survey": 0,
            "tinker": 0,
            "finesse": 0,
            "prowl": 0,
            "skirmish": 0,
            "wreck": 0,
            "bizarre": 0,
            "command": 0,
            "consort": 0,
            "sway": 0,
        }
        self.recipient = Character.objects.create(
            user=self.user_a,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Beneficiary",
            heritage=self.hman,
            action_dots=dots,
            stress=1,
        )
        self.helper = Character.objects.create(
            user=self.user_h,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Helper AHP",
            heritage=self.hman,
            action_dots=dots,
            stress=4,
        )
        self.session = Session.objects.create(campaign=self.campaign, name="AHP S")
        self.campaign.active_session = self.session
        self.campaign.save(update_fields=["active_session"])

    def test_assist_help_creates_pending_second_grant_rejected(self):
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/characters/{self.recipient.id}/assist-help/"
        r1 = self.client.post(
            url,
            {"helper_character_id": self.helper.id, "session_id": self.session.id},
            format="json",
        )
        self.assertEqual(r1.status_code, status.HTTP_200_OK, r1.data)
        self.assertEqual(AssistHelpPending.objects.count(), 1)
        self.helper.refresh_from_db()
        self.assertEqual(self.helper.stress, 5)
        r2 = self.client.post(
            url,
            {"helper_character_id": self.helper.id, "session_id": self.session.id},
            format="json",
        )
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(AssistHelpPending.objects.count(), 1)

    def test_roll_with_pending_adds_die_without_second_stress(self):
        AssistHelpPending.objects.create(
            session=self.session,
            recipient=self.recipient,
            helper=self.helper,
        )
        before = self.helper.stress
        self.client.force_authenticate(user=self.user_a)
        r = self.client.post(
            f"/api/characters/{self.recipient.id}/roll-action/",
            {
                "action": "hunt",
                "session_id": self.session.id,
                "assist_helper_id": self.helper.id,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["total_dice"], 2)
        self.helper.refresh_from_db()
        self.assertEqual(self.helper.stress, before)
        self.assertFalse(
            AssistHelpPending.objects.filter(recipient=self.recipient).exists()
        )

    def test_action_roll_without_assist_clears_pending(self):
        AssistHelpPending.objects.create(
            session=self.session,
            recipient=self.recipient,
            helper=self.helper,
        )
        stress_before = self.helper.stress
        self.client.force_authenticate(user=self.user_a)
        r = self.client.post(
            f"/api/characters/{self.recipient.id}/roll-action/",
            {
                "action": "hunt",
                "session_id": self.session.id,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["total_dice"], 1)
        self.assertFalse(
            AssistHelpPending.objects.filter(recipient=self.recipient).exists()
        )
        self.helper.refresh_from_db()
        self.assertEqual(self.helper.stress, stress_before)
