"""settle_encoded_session_xp: STRUGGLE from rolls; idempotent flag; dev pool.

Playbook-specific (PLAYBOOK_SPECIFIC) XP is not auto-granted from roll tags.
"""
import re

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
from characters.services.session_xp_settlement import (
    development_session_xp_to_pool_amount,
    settle_encoded_session_xp,
)

_SESSION_ENCODED_XP_CAP = 2
_MANUAL_TRACK_PREFIX_RE = re.compile(
    r"^\[(insight|prowess|resolve|heritage|playbook)\]",
    re.IGNORECASE,
)


def _manual_track_xp_for_session(character, session):
    """Matches CampaignManagement `sumManualTrackXpForSession` (modal Manual→tracks)."""
    total = 0
    for e in ExperienceTracker.objects.filter(
        character=character, session=session, trigger="MANUAL"
    ):
        if _MANUAL_TRACK_PREFIX_RE.match((e.description or "").strip()):
            total += int(e.xp_gained or 0)
    return total


def _encoded_playbook_preview_from_rolls(character, session):
    """Mirror frontend: STRUGGLE-only encoded playbook (no ability-tag auto)."""
    rolls = list(Roll.objects.filter(session=session, character=character))
    struggle_events = 0
    for r in rolls:
        if (r.roll_type or "").upper() != "CLEAR_STRESS":
            continue
        if "vice" not in (r.action_name or "").lower():
            continue
        desc = (r.description or "").lower()
        if "overindulgence" in desc:
            struggle_events += 1
        elif (r.outcome or "") in ("FAILURE", "BOTCH"):
            struggle_events += 1
    struggle_would = min(_SESSION_ENCODED_XP_CAP, struggle_events)
    return 0, struggle_would, struggle_would


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

    def test_abilities_tag_does_not_auto_grant_playbook_xp(self):
        self._roll(description="[Abilities: Stand ability foo]")
        settle_encoded_session_xp(self.session, self.gm)
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook", 0), 5)
        self.assertFalse(
            ExperienceTracker.objects.filter(
                trigger="PLAYBOOK_SPECIFIC",
                character=self.character,
                session=self.session,
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
        self.assertEqual(self.character.xp_clocks.get("playbook", 0), 5)
        self.assertEqual(self.character.unallocated_xp, 1)

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
        self.assertEqual(self.character.xp_clocks.get("playbook", 0), 5)
        self.assertEqual(self.character.unallocated_xp, 2)
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
        self.assertEqual(self.character.xp_clocks.get("playbook", 0), 5)
        self.assertEqual(self.character.unallocated_xp, 1)

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
        self.assertEqual(self.session.status, "COMPLETED")
        self.character.refresh_from_db()
        self.assertEqual(self.character.xp_clocks.get("playbook", 0), 5)
        self.assertFalse(
            ExperienceTracker.objects.filter(
                trigger="PLAYBOOK_SPECIFIC",
                character=self.character,
                session=self.session,
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

    def test_settle_character_without_stand_does_not_crash(self):
        """Postgres rejects FOR UPDATE on nullable stand join; must lock Character only."""
        self.session.characters_involved.add(self.character)
        # No Stand row → LEFT OUTER JOIN if select_related("stand") without of=("self",).
        settle_encoded_session_xp(self.session, self.gm)
        self.session.refresh_from_db()
        self.assertTrue(self.session.auto_encoded_xp_settled)
        self.character.refresh_from_db()
        self.assertEqual(self.character.unallocated_xp, 0)

    def test_dev_pool_includes_tracker_only_pc_when_involved_empty(self):
        """Scorecard toggles without characters_involved / rolls still get Dev→pool."""
        Stand.objects.create(
            character=self.character,
            name="Tracker Stand",
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
        ExperienceTracker.objects.create(
            character=self.character,
            session=self.session,
            trigger="BELIEFS",
            description="Session XP trigger: BELIEFS",
            xp_gained=1,
            award_source="PLAYER",
            clock_key="playbook",
        )
        settle_encoded_session_xp(self.session, self.gm)
        self.character.refresh_from_db()
        self.assertEqual(self.character.unallocated_xp, 2)
        self.session.refresh_from_db()
        self.assertTrue(self.session.auto_encoded_xp_settled)

    def test_patch_clear_active_applies_encoded_xp_end_live_ui_path(self):
        """
        Same HTTP path as SessionDetail "End & apply encoded XP":
        PATCH /api/campaigns/:id/ with active_session=null (no skip flag).

        Asserts DB state: STRUGGLE → free pool, Dev→pool, Manual→tracks, Total.
        """
        user_b = User.objects.create_user(username="pl_sxp_b", password="pw")
        dots = self.character.action_dots
        char_b = Character.objects.create(
            user=user_b,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Second PC",
            heritage=self.h,
            action_dots=dots,
            xp_clocks={"playbook": 4},
            unallocated_xp=0,
        )
        self.session.characters_involved.add(self.character, char_b)

        self._roll(
            description="[Abilities: stand rush]",
            outcome="FULL_SUCCESS",
            action_name="skirmish",
        )
        self._roll(
            roll_type="CLEAR_STRESS",
            action_name="vice",
            outcome="FAILURE",
            description="no relief",
        )
        Roll.objects.create(
            character=char_b,
            session=self.session,
            roll_type="ACTION",
            outcome="FULL_SUCCESS",
            description="other pc roll",
            action_name="command",
        )

        ExperienceTracker.objects.create(
            character=self.character,
            session=self.session,
            trigger="MANUAL",
            description="[playbook] GM spot award",
            xp_gained=1,
        )

        Stand.objects.create(
            character=self.character,
            name="Stand A",
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
        Stand.objects.create(
            character=char_b,
            name="Stand B",
            type="FIGHTING",
            form="Humanoid",
            consciousness_level="C",
            power="D",
            speed="D",
            range="D",
            durability="D",
            precision="D",
            development="D",
        )

        prev_pool_a = int(self.character.unallocated_xp or 0)
        prev_pool_b = int(char_b.unallocated_xp or 0)
        prev_play_a = int(self.character.xp_clocks.get("playbook", 0) or 0)
        prev_play_b = int(char_b.xp_clocks.get("playbook", 0) or 0)
        st_a, sg_a, enc_a = _encoded_playbook_preview_from_rolls(
            self.character, self.session
        )
        st_b, sg_b, enc_b = _encoded_playbook_preview_from_rolls(char_b, self.session)
        self.assertEqual(st_a, 0)
        self.assertEqual(st_b, 0)
        dev_a = development_session_xp_to_pool_amount(self.character)
        dev_b = development_session_xp_to_pool_amount(char_b)
        manual_a = _manual_track_xp_for_session(self.character, self.session)
        manual_b = _manual_track_xp_for_session(char_b, self.session)
        total_preview_a = enc_a + dev_a + manual_a
        total_preview_b = enc_b + dev_b + manual_b

        client = APIClient()
        client.force_authenticate(user=self.gm)
        self.campaign.active_session = self.session
        self.campaign.save(update_fields=["active_session"])
        res = client.patch(
            f"/api/campaigns/{self.campaign.id}/",
            {"active_session": None},
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content))
        self.session.refresh_from_db()
        self.assertTrue(self.session.auto_encoded_xp_settled)
        self.assertEqual(self.session.status, "COMPLETED")

        self.character.refresh_from_db()
        char_b.refresh_from_db()

        # Scorecard STRUGGLE + Dev bank to free pool; playbook clocks unchanged.
        self.assertEqual(
            int(self.character.xp_clocks.get("playbook", 0) or 0),
            prev_play_a,
        )
        self.assertEqual(
            int(char_b.xp_clocks.get("playbook", 0) or 0),
            prev_play_b,
        )
        self.assertEqual(
            ExperienceTracker.objects.filter(
                character=self.character,
                session=self.session,
                trigger="PLAYBOOK_SPECIFIC",
            ).aggregate(s=Sum("xp_gained"))["s"]
            or 0,
            0,
        )
        self.assertEqual(
            ExperienceTracker.objects.filter(
                character=self.character,
                session=self.session,
                trigger="STRUGGLE",
            ).aggregate(s=Sum("xp_gained"))["s"]
            or 0,
            sg_a,
        )
        self.assertFalse(
            ExperienceTracker.objects.filter(
                character=char_b, session=self.session, trigger="PLAYBOOK_SPECIFIC"
            ).exists()
        )
        self.assertFalse(
            ExperienceTracker.objects.filter(
                character=char_b, session=self.session, trigger="STRUGGLE"
            ).exists()
        )

        self.assertEqual(self.character.unallocated_xp, prev_pool_a + enc_a + dev_a)
        self.assertEqual(char_b.unallocated_xp, prev_pool_b + enc_b + dev_b)
        pool_row_a = ExperienceTracker.objects.filter(
            character=self.character,
            session=self.session,
            trigger="MANUAL",
            description__icontains="Session end (pool)",
        )
        self.assertEqual(
            pool_row_a.aggregate(s=Sum("xp_gained"))["s"] or 0, dev_a
        )
        pool_row_b = ExperienceTracker.objects.filter(
            character=char_b,
            session=self.session,
            trigger="MANUAL",
            description__icontains="Session end (pool)",
        )
        self.assertEqual(
            pool_row_b.aggregate(s=Sum("xp_gained"))["s"] or 0, dev_b
        )

        self.assertEqual(
            _manual_track_xp_for_session(self.character, self.session),
            manual_a,
        )
        self.assertEqual(
            _manual_track_xp_for_session(char_b, self.session),
            manual_b,
        )

        gained_pool_a = int(self.character.unallocated_xp or 0) - prev_pool_a
        gained_pool_b = int(char_b.unallocated_xp or 0) - prev_pool_b
        self.assertEqual(gained_pool_a, enc_a + dev_a)
        self.assertEqual(gained_pool_b, enc_b + dev_b)
        self.assertEqual(gained_pool_a + manual_a, total_preview_a)
        self.assertEqual(gained_pool_b + manual_b, total_preview_b)
