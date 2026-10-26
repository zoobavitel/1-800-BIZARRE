"""A PC may only join a campaign its user is in (S3). The crew rule is checked too."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, CampaignInvitation, Character, Crew, Heritage


class CharacterCampaignMembershipTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="cm_gm", password="pw-cm-gm-1")
        self.player = User.objects.create_user(username="cm_player", password="pw-cm-player-1")
        self.stranger = User.objects.create_user(username="cm_stranger", password="pw-cm-stranger-1")
        self.newbie = User.objects.create_user(username="cm_newbie", password="pw-cm-newbie-1")
        self.staff = User.objects.create_user(username="cm_staff", password="pw-cm-staff-1", is_staff=True)

        self.campaign = Campaign.objects.create(name="CM Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        self.crew = Crew.objects.create(name="CM Crew", campaign=self.campaign)
        self.other_campaign = Campaign.objects.create(name="CM Other", gm=self.stranger)
        self.other_crew = Crew.objects.create(name="CM Other Crew", campaign=self.other_campaign)
        self.heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        self.client = APIClient()

    def _create(self, user, campaign):
        self.client.force_authenticate(user)
        return self.client.post(
            "/api/characters/",
            {"true_name": "CM PC", "campaign": campaign.pk, "heritage": self.heritage.pk},
            format="json",
        )

    def _pc(self, user, campaign=None, crew=None):
        return Character.objects.create(
            user=user, campaign=campaign, crew=crew, true_name="CM PC", heritage=self.heritage
        )

    # Create

    def test_stranger_cannot_create_a_pc_in_someone_elses_campaign(self):
        response = self._create(self.stranger, self.campaign)
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn("campaign", response.data)
        self.assertFalse(Character.objects.filter(user=self.stranger, campaign=self.campaign).exists())

    def test_player_and_gm_can_create_a_pc_in_their_campaign(self):
        self.assertEqual(self._create(self.player, self.campaign).status_code, 201)
        self.assertEqual(self._create(self.gm, self.campaign).status_code, 201)

    def test_staff_are_exempt(self):
        self.assertEqual(self._create(self.staff, self.campaign).status_code, 201)

    # Change

    def test_stranger_cannot_move_their_pc_into_someone_elses_campaign(self):
        pc = self._pc(self.stranger)
        self.client.force_authenticate(self.stranger)
        response = self.client.patch(f"/api/characters/{pc.pk}/", {"campaign": self.campaign.pk}, format="json")
        self.assertEqual(response.status_code, 400, response.content)
        pc.refresh_from_db()
        self.assertIsNone(pc.campaign_id)

    def test_crew_must_be_in_the_pcs_campaign(self):
        pc = self._pc(self.player, campaign=self.campaign)
        self.client.force_authenticate(self.player)
        response = self.client.patch(f"/api/characters/{pc.pk}/", {"crew_id": self.other_crew.pk}, format="json")
        self.assertEqual(response.status_code, 400, response.content)
        pc.refresh_from_db()
        self.assertIsNone(pc.crew_id)
        ok = self.client.patch(f"/api/characters/{pc.pk}/", {"crew_id": self.crew.pk}, format="json")
        self.assertEqual(ok.status_code, 200, ok.content)

    def test_leaving_a_campaign_is_allowed(self):
        pc = self._pc(self.player, campaign=self.campaign)
        self.client.force_authenticate(self.player)
        response = self.client.patch(f"/api/characters/{pc.pk}/", {"campaign": None}, format="json")
        self.assertEqual(response.status_code, 200, response.content)

    # Unchanged values always pass (legacy mismatches keep saving)

    def test_legacy_mismatch_still_saves_when_unchanged(self):
        # A PC already in a campaign its owner isn't in. The sheet autosave
        # sends `campaign` (unchanged) on every save, and never `crew`.
        pc = self._pc(self.stranger, campaign=self.campaign, crew=self.other_crew)
        self.client.force_authenticate(self.stranger)
        response = self.client.patch(
            f"/api/characters/{pc.pk}/",
            {"campaign": self.campaign.pk, "rival": "Still saves"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        pc.refresh_from_db()
        self.assertEqual(pc.rival, "Still saves")

    # The new-player path: invite, accept, then attach

    def test_invited_player_can_attach_after_accepting(self):
        pc = self._pc(self.newbie)
        self.client.force_authenticate(self.newbie)
        before = self.client.patch(f"/api/characters/{pc.pk}/", {"campaign": self.campaign.pk}, format="json")
        self.assertEqual(before.status_code, 400, before.content)

        invitation = CampaignInvitation.objects.create(
            campaign=self.campaign, invited_user=self.newbie, invited_by=self.gm
        )
        accepted = self.client.post(f"/api/campaign-invitations/{invitation.pk}/accept/")
        self.assertIn(accepted.status_code, (200, 201), accepted.content)

        # Through the sheet save...
        saved = self.client.patch(f"/api/characters/{pc.pk}/", {"campaign": self.campaign.pk}, format="json")
        self.assertEqual(saved.status_code, 200, saved.content)
        # ...and through assign-character.
        pc2 = self._pc(self.newbie)
        assigned = self.client.post(
            f"/api/campaigns/{self.campaign.pk}/assign-character/", {"character_id": pc2.pk}, format="json"
        )
        self.assertIn(assigned.status_code, (200, 201), assigned.content)
