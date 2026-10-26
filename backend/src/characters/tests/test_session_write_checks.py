"""Session writes stay inside the GM's own campaign (S4)."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Heritage, Session


class SessionWriteCheckTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="sw_gm", password="pw-sw-gm-1")
        self.player = User.objects.create_user(username="sw_player", password="pw-sw-player-1")
        self.stranger = User.objects.create_user(username="sw_stranger", password="pw-sw-stranger-1")
        self.staff = User.objects.create_user(username="sw_staff", password="pw-sw-staff-1", is_staff=True)
        heritage, _ = Heritage.objects.get_or_create(name="Human", defaults={"base_hp": 0, "description": ""})

        self.campaign = Campaign.objects.create(name="SW Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        self.pc = Character.objects.create(
            user=self.player, campaign=self.campaign, true_name="SW PC", heritage=heritage
        )
        self.session = Session.objects.create(campaign=self.campaign, name="SW S1")

        # A victim PC in a different campaign, with armor marked.
        other_gm = User.objects.create_user(username="sw_other_gm", password="pw-sw-other-1")
        self.other_campaign = Campaign.objects.create(name="SW Other", gm=other_gm)
        self.victim = Character.objects.create(
            user=other_gm, campaign=self.other_campaign, true_name="SW Victim",
            heritage=heritage, physical_armor_used=1, light_armor_used=True,
        )
        self.client = APIClient()

    # Create

    def _create(self, user, campaign):
        self.client.force_authenticate(user)
        return self.client.post("/api/sessions/", {"campaign": campaign.pk, "name": "New"}, format="json")

    def test_stranger_cannot_create_a_session_in_someone_elses_campaign(self):
        response = self._create(self.stranger, self.campaign)
        self.assertEqual(response.status_code, 403, response.content)
        self.assertFalse(Session.objects.filter(campaign=self.campaign, name="New").exists())

    def test_player_cannot_create_a_session(self):
        self.assertEqual(self._create(self.player, self.campaign).status_code, 403)

    def test_gm_and_staff_can_create_a_session(self):
        self.assertEqual(self._create(self.gm, self.campaign).status_code, 201)
        self.assertEqual(self._create(self.staff, self.campaign).status_code, 201)

    # Loadout PATCH

    def test_loadout_patch_leaves_pcs_outside_the_campaign_untouched(self):
        self.client.force_authenticate(self.gm)
        response = self.client.patch(
            f"/api/sessions/{self.session.pk}/",
            {"loadout_by_character": {str(self.victim.pk): {"band": "light"}}},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.victim.refresh_from_db()
        self.assertEqual(self.victim.physical_armor_used, 1)
        self.assertTrue(self.victim.light_armor_used)
        self.session.refresh_from_db()
        self.assertNotIn(str(self.victim.pk), self.session.loadout_by_character or {})

    def test_loadout_patch_still_applies_to_the_campaigns_own_pc(self):
        self.client.force_authenticate(self.gm)
        response = self.client.patch(
            f"/api/sessions/{self.session.pk}/",
            {"loadout_by_character": {str(self.pc.pk): {"band": "light"}}},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.session.refresh_from_db()
        self.assertEqual(self.session.loadout_by_character[str(self.pc.pk)]["band"], "light")

    # Full PUT and characters_involved

    def test_gm_full_put_of_the_session_works(self):
        self.client.force_authenticate(self.gm)
        current = self.client.get(f"/api/sessions/{self.session.pk}/").data
        current["characters_involved"] = [self.pc.pk]
        response = self.client.put(f"/api/sessions/{self.session.pk}/", current, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(list(self.session.characters_involved.values_list("pk", flat=True)), [self.pc.pk])

    def test_characters_involved_drops_pcs_from_other_campaigns(self):
        self.client.force_authenticate(self.gm)
        response = self.client.patch(
            f"/api/sessions/{self.session.pk}/",
            {"characters_involved": [self.pc.pk, self.victim.pk]},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(list(self.session.characters_involved.values_list("pk", flat=True)), [self.pc.pk])
