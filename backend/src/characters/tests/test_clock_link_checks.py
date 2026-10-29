"""A clock may only point at things in its own campaign (S6).

Before this, a campaign member could create or edit a clock bound to another
player's PC (it then shows on that player's sheet), or point a clock at a
crew, NPC, faction or session from a different campaign. The user's rule:
only a PC's player or the GM may put a clock on that PC. Players share
clocks as crew or campaign clocks.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Crew, Heritage, ProgressClock


class ClockLinkCheckTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="clk_gm", password="pw-clk-gm-1")
        self.owner = User.objects.create_user(username="clk_owner", password="pw-clk-owner-1")
        self.other = User.objects.create_user(username="clk_other", password="pw-clk-other-1")
        self.campaign = Campaign.objects.create(name="Clock Camp", gm=self.gm)
        self.campaign.players.add(self.owner, self.other)
        self.crew = Crew.objects.create(name="Clock Crew", campaign=self.campaign)
        heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        self.pc = Character.objects.create(
            user=self.owner, campaign=self.campaign, crew=self.crew,
            true_name="Clock Owner PC", heritage=heritage,
        )
        Character.objects.create(
            user=self.other, campaign=self.campaign, crew=self.crew,
            true_name="Clock Other PC", heritage=heritage,
        )
        far_gm = User.objects.create_user(username="clk_far_gm", password="pw-clk-far-1")
        self.far_campaign = Campaign.objects.create(name="Far Camp", gm=far_gm)
        self.far_crew = Crew.objects.create(name="Far Crew", campaign=self.far_campaign)
        self.client = APIClient()

    def create(self, user, **fields):
        self.client.force_authenticate(user)
        body = {"name": "Clock", "clock_type": "DANGER", "max_segments": 4,
                "campaign": self.campaign.id, **fields}
        return self.client.post("/api/progress-clocks/", body, format="json")

    def own_clock(self, user):
        return ProgressClock.objects.create(
            name="Mine", clock_type="DANGER", max_segments=4,
            campaign=self.campaign, created_by=user,
        )

    def test_another_player_cannot_bind_a_clock_to_my_pc(self):
        response = self.create(self.other, character=self.pc.id)
        self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        self.assertFalse(ProgressClock.objects.filter(character=self.pc).exists())

    def test_another_player_cannot_move_their_clock_onto_my_pc(self):
        clock = self.own_clock(self.other)
        self.client.force_authenticate(self.other)
        response = self.client.patch(
            f"/api/progress-clocks/{clock.id}/", {"character": self.pc.id}, format="json"
        )
        self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        clock.refresh_from_db()
        self.assertIsNone(clock.character_id)

    def test_owner_and_gm_can_bind_to_the_pc(self):
        self.assertEqual(self.create(self.owner, character=self.pc.id).status_code, 201)
        self.assertEqual(self.create(self.gm, character=self.pc.id).status_code, 201)

    def test_a_member_can_still_make_crew_and_campaign_clocks(self):
        self.assertEqual(self.create(self.other, crew=self.crew.id).status_code, 201)
        self.assertEqual(self.create(self.other).status_code, 201)

    def test_links_must_be_in_the_clocks_campaign(self):
        response = self.create(self.gm, crew=self.far_crew.id)
        self.assertEqual(response.status_code, 400, getattr(response, "data", None))

    def test_a_non_gm_creator_cannot_move_the_clock_to_another_campaign(self):
        clock = self.own_clock(self.owner)
        self.far_campaign.players.add(self.owner)
        self.client.force_authenticate(self.owner)
        response = self.client.patch(
            f"/api/progress-clocks/{clock.id}/", {"campaign": self.far_campaign.id}, format="json"
        )
        self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        clock.refresh_from_db()
        self.assertEqual(clock.campaign_id, self.campaign.id)
