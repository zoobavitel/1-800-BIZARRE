"""settle_encoded_session_xp: STRUGGLE/STANDOUT from rolls; idempotent flag."""
from django.contrib.auth.models import User
from django.db.models import Sum
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    Crew,
    ExperienceTracker,
    Heritage,
    Roll,
    Session,
    Stand,
)
from characters.services.session_xp_settlement import settle_encoded_session_xp


class SessionEncodedXpSettlementTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="gm_sxp", password="pw")
        self.user = User.objects.create_user(username="pl_sxp", password="pw")
        self.campaign = Campaign.objects.create(name="SXP Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="SXP Crew", campaign=self.campaign)
        self.h, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "t"},
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
        self.character = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Test PC",
            heritage=self.h,
            action_dots=dots,
            xp_clocks={"playbook": 5},
        )
        self.session = Session.objects.create(
            campaign=self.campaign,
            name="S1",
            status="ACTIVE",
        )

    def _roll(self, **kwargs):
        defaults = {
            "character": self.character,
            "session": self.session,
            "roll_type": "ACTION",
            "outcome": "FULL_SUCCESS",
            "description": "",
            "action_name": "hunt",
        }
        defaults.update(kwargs)
        return Roll.objects.create(**defaults)

    def test_idempotent_second_call_skips(self):
        self._roll(
            roll_type="CLEAR_STRESS",
            action_name="vice gamble",
            outcome="FAILURE",
            description="stress clear",
        )
        r1 = settle_encoded_session_xp(self.session, self.gm)
        self.assertNotIn("skipped", r1)
        self.session.refresh_from_db()
        self.assertTrue(self.session.auto_encoded_xp_settled)

        r2 = settle_encoded_session_xp(self.session, self.gm)
        self.assertTrue(r2.get("skipped"))

        struggle_n = ExperienceTracker.objects.filter(
            character=self.character,
            session=self.session,
            trigger="STRUGGLE",
        ).count()
        self.assertEqual(struggle_n, 1)

    def test_standout_from_abilities_tag(self):
        self._roll(description="[Abilities: Stand ability foo]")
        settle_encoded_session_xp(self.session, self.gm)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook", 0), 6)
        self.assertTrue(
            ExperienceTracker.objects.filter(
                trigger="STANDOUT", character=self.character, session=self.session
            ).exists()
        )

    def test_struggle_failed_vice_clear(self):
        self._roll(
            roll_type="CLEAR_STRESS",
            action_name="vice",
            outcome="FAILURE",
            description="did not clear",
        )
        settle_encoded_session_xp(self.session, self.gm)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook", 0), 6)

    def test_struggle_cap_two_per_session(self):
        self._roll(
            roll_type="CLEAR_STRESS",
            action_name="vice",
            outcome="FAILURE",
        )
        self._roll(
            roll_type="CLEAR_STRESS",
            action_name="vice",
            outcome="BOTCH",
        )
        self._roll(
            roll_type="CLEAR_STRESS",
            action_name="vice",
            outcome="FAILURE",
        )
        settle_encoded_session_xp(self.session, self.gm)
        self.character.refresh_from_db()
        # 5 + 2 cap
        self.assertEqual(self.character.xp_clocks.get("playbook", 0), 7)
        # ... + 2 STRUGGLE tracker rows (actual grant may be one row of 2 xp)
        total_struggle_xp = (
            ExperienceTracker.objects.filter(
                character=self.character,
                session=self.session,
                trigger="STRUGGLE",
            ).aggregate(s=Sum("xp_gained"))["s"]
            or 0
        )
        self.assertEqual(total_struggle_xp, 2)

    def test_settlement_runs_before_delete_active_session(self):
        """Deleting the campaign's active session must still apply encoded session XP."""
        client = APIClient()
        client.force_authenticate(user=self.gm)
        self.campaign.active_session = self.session
        self.campaign.save(update_fields=["active_session"])
        self._roll(
            roll_type="CLEAR_STRESS",
            action_name="vice",
            outcome="FAILURE",
            description="did not clear",
        )
        sid = self.session.id
        res = client.delete(f"/api/sessions/{sid}/")
        self.assertIn(res.status_code, (200, 204), getattr(res, "data", res.content))
        self.assertFalse(Session.objects.filter(pk=sid).exists())
        self.campaign.refresh_from_db()
        self.assertIsNone(self.campaign.active_session_id)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook", 0), 6)

    def test_patch_clear_active_skip_encoded_xp(self):
        """PATCH campaign with skip flag ends live without granting encoded XP."""
        client = APIClient()
        client.force_authenticate(user=self.gm)
        self.campaign.active_session = self.session
        self.campaign.save(update_fields=["active_session"])
        self._roll(description="[Abilities: Stand ability foo]")
        res = client.patch(
            f"/api/campaigns/{self.campaign.id}/",
            {"active_session": None, "skip_encoded_xp_settlement": True},
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content))
        self.session.refresh_from_db()
        self.assertTrue(self.session.auto_encoded_xp_settled)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook", 0), 5)
        self.assertFalse(
            ExperienceTracker.objects.filter(
                trigger="STANDOUT", character=self.character, session=self.session
            ).exists()
        )

    def test_stand_development_session_xp_to_unallocated_pool(self):
        self.session.characters_involved.add(self.character)
        Stand.objects.create(
            character=self.character,
            name="Test Stand",
            type="FIGHTING",
            form="Humanoid",
            consciousness_level="C",
            power="D",
            speed="D",
            range="D",
            durability="D",
            precision="D",
            development="C",
        )
        settle_encoded_session_xp(self.session, self.gm)
        self.character.refresh_from_db()
        self.assertEqual(self.character.unallocated_xp, 2)
        self.assertTrue(
            ExperienceTracker.objects.filter(
                character=self.character,
                session=self.session,
                trigger="MANUAL",
                description__icontains="Session end (pool)",
            ).exists()
        )
