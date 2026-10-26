"""Who may roll on a PC, and when an inline assist may charge a helper's stress.

roll-action used to check only that the caller could see the character, so
any player in the campaign could roll on (and push stress onto) another
player's PC. Now only the PC's owner, the campaign GM or staff may.

The inline assist (assist_helper_id on the roller's request) stays
table-trust on purpose: the roller may charge a crewmate 1 stress without the
helper's player clicking anything. The one exception is a +1 that would fill
the helper's stress track (trauma); only the helper's owner, the GM or staff
may charge that. The helper-initiated assist-help flow checks rights itself.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, CharacterHistory, Crew, Heritage, Roll, Session
from characters.roll_helpers import max_stress_slots_for_character

DOTS = {
    "hunt": 1, "study": 0, "survey": 0, "tinker": 0,
    "finesse": 0, "prowl": 0, "skirmish": 0, "wreck": 0,
    "bizarre": 0, "command": 0, "consort": 0, "sway": 0,
}


class RollActionPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm_rap", password="pw-gm-rap")
        self.owner = User.objects.create_user(username="owner_rap", password="pw-owner-rap")
        self.helper_user = User.objects.create_user(username="helper_rap", password="pw-helper-rap")
        self.campaign = Campaign.objects.create(name="RAP Camp", gm=self.gm)
        self.campaign.players.add(self.owner, self.helper_user)
        self.crew = Crew.objects.create(name="RAP Crew", campaign=self.campaign)
        heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": "test"}
        )
        self.actor = Character.objects.create(
            user=self.owner, campaign=self.campaign, crew=self.crew,
            true_name="Actor RAP", heritage=heritage, action_dots=dict(DOTS), stress=2,
        )
        self.helper = Character.objects.create(
            user=self.helper_user, campaign=self.campaign, crew=self.crew,
            true_name="Helper RAP", heritage=heritage, action_dots=dict(DOTS), stress=5,
        )
        self.session = Session.objects.create(campaign=self.campaign, name="RAP S1")
        self.max = max_stress_slots_for_character(self.helper)

    def roll(self, user, character, **extra):
        self.client.force_authenticate(user=user)
        body = {"action": "hunt", "session_id": self.session.id, **extra}
        return self.client.post(
            f"/api/characters/{character.id}/roll-action/", body, format="json"
        )

    # Who may roll

    def test_another_player_cannot_roll_on_someone_elses_pc(self):
        rolls_before = Roll.objects.count()
        response = self.roll(self.helper_user, self.actor, push_dice=True)
        self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        self.actor.refresh_from_db()
        self.assertEqual(self.actor.stress, 2)
        self.assertEqual(Roll.objects.count(), rolls_before)

    def test_owner_can_roll(self):
        self.assertEqual(self.roll(self.owner, self.actor).status_code, 200)

    def test_gm_can_fortune_roll_on_a_player_pc(self):
        response = self.roll(self.gm, self.actor, roll_type="FORTUNE", dice_pool=2)
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))

    # Inline assist

    def test_inline_assist_below_the_trauma_box_needs_no_helper_consent(self):
        response = self.roll(self.owner, self.actor, assist_helper_id=self.helper.id)
        self.assertEqual(response.status_code, 200, response.data)
        self.helper.refresh_from_db()
        self.assertEqual(self.helper.stress, 6)

    def test_inline_assist_that_would_fill_the_helper_track_is_refused(self):
        self.helper.stress = self.max - 1
        self.helper.save(update_fields=["stress"])
        response = self.roll(self.owner, self.actor, assist_helper_id=self.helper.id)
        self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        self.helper.refresh_from_db()
        self.assertEqual(self.helper.stress, self.max - 1)

    def test_gm_may_charge_the_last_box_inline(self):
        self.helper.stress = self.max - 1
        self.helper.save(update_fields=["stress"])
        response = self.roll(self.gm, self.actor, assist_helper_id=self.helper.id)
        self.assertEqual(response.status_code, 200, response.data)
        self.helper.refresh_from_db()
        self.assertEqual(self.helper.stress, self.max)

    def test_inline_assist_on_a_full_track_is_refused_for_a_non_owner(self):
        self.helper.stress = self.max
        self.helper.save(update_fields=["stress"])
        response = self.roll(self.owner, self.actor, assist_helper_id=self.helper.id)
        self.assertEqual(response.status_code, 403, getattr(response, "data", None))

    def test_inline_assist_on_a_full_track_is_still_400_for_the_gm(self):
        self.helper.stress = self.max
        self.helper.save(update_fields=["stress"])
        response = self.roll(self.gm, self.actor, assist_helper_id=self.helper.id)
        self.assertEqual(response.status_code, 400, getattr(response, "data", None))

    def test_inline_assist_shows_in_the_roll_and_the_helper_history(self):
        response = self.roll(self.owner, self.actor, assist_helper_id=self.helper.id)
        self.assertEqual(response.status_code, 200, response.data)
        names = [m.get("name") for m in response.data.get("modifier_sources", [])]
        self.assertIn("Assist (Helper RAP, +1 stress)", names)
        entry = (
            CharacterHistory.objects.filter(character=self.helper)
            .order_by("-timestamp", "-id")
            .first()
        )
        self.assertIsNotNone(entry)
        # The history snapshot stores scalars as strings.
        self.assertEqual(entry.changed_fields.get("stress"), {"old": "5", "new": "6"})
        self.assertEqual(entry.editor_id, self.owner.id)
