"""Group action resolve: leader loses 1 remaining stress per failed non-leader roll."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from characters.models import Campaign, Character, Crew, GroupAction, Heritage, Roll, Session


class GroupActionResolveLeaderStressTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm_gar", password="pass")
        self.leader_user = User.objects.create_user(username="leader_gar", password="pass")
        self.follower_user = User.objects.create_user(username="follow_gar", password="pass")
        self.campaign = Campaign.objects.create(name="GAR Camp", gm=self.gm)
        self.crew = Crew.objects.create(name="GAR Crew", campaign=self.campaign)
        self.h, _ = Heritage.objects.get_or_create(
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
        self.leader = Character.objects.create(
            user=self.leader_user,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Leader GAR",
            heritage=self.h,
            action_dots=dots,
            stress=10,
        )
        self.follower = Character.objects.create(
            user=self.follower_user,
            campaign=self.campaign,
            crew=self.crew,
            true_name="Follow GAR",
            heritage=self.h,
            action_dots=dots,
            stress=5,
        )
        self.session = Session.objects.create(campaign=self.campaign, name="GAR S1")

    def _rolls(self, leader_tier_die, follower_tier_die):
        """Build dice results where tier_die_from_action_pool is leader_tier / follower_tier."""
        ga = GroupAction.objects.create(
            session=self.session,
            leader=self.leader,
            action_name="hunt",
            status="OPEN",
        )
        Roll.objects.create(
            character=self.leader,
            session=self.session,
            roll_type="ACTION",
            action_name="hunt",
            dice_pool=1,
            results=[leader_tier_die],
            outcome="FULL_SUCCESS" if leader_tier_die >= 6 else "FAILURE",
            group_action=ga,
            pool_action_rating=1,
        )
        Roll.objects.create(
            character=self.follower,
            session=self.session,
            roll_type="ACTION",
            action_name="hunt",
            dice_pool=1,
            results=[follower_tier_die],
            outcome="FULL_SUCCESS" if follower_tier_die >= 6 else "FAILURE",
            group_action=ga,
            pool_action_rating=1,
        )
        return ga

    def test_resolve_deducts_stress_per_non_leader_failure(self):
        ga = self._rolls(leader_tier_die=6, follower_tier_die=2)
        self.client.force_authenticate(user=self.gm)
        url = f"/api/group-actions/{ga.id}/resolve/"
        r = self.client.post(url, {}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("failures"), 1)
        self.leader.refresh_from_db()
        self.assertEqual(self.leader.stress, 9)

    def test_resolve_no_loss_when_follower_succeeds(self):
        ga = self._rolls(leader_tier_die=6, follower_tier_die=6)
        self.client.force_authenticate(user=self.gm)
        r = self.client.post(f"/api/group-actions/{ga.id}/resolve/", {}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data.get("failures"), 0)
        self.leader.refresh_from_db()
        self.assertEqual(self.leader.stress, 10)
