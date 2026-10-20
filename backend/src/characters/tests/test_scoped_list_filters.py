"""List filters that let clients fetch one campaign / one session instead of everything."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Character, ExperienceTracker, Session


class CharacterCampaignFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm_f", password="pw")
        self.player = User.objects.create_user(username="pl_f", password="pw")
        self.outsider = User.objects.create_user(username="out_f", password="pw")
        self.camp_a = Campaign.objects.create(name="A", gm=self.gm)
        self.camp_b = Campaign.objects.create(name="B", gm=self.gm)
        self.camp_a.players.add(self.player)
        self.pc_a = Character.objects.create(
            user=self.player, campaign=self.camp_a, true_name="PC A"
        )
        self.pc_b = Character.objects.create(
            user=self.player, campaign=self.camp_b, true_name="PC B"
        )
        self.foreign = Character.objects.create(
            user=self.outsider, true_name="Not yours"
        )

    def _ids(self, user, url):
        self.client.force_authenticate(user=user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200, res.data)
        return {row["id"] for row in res.data}

    def test_campaign_filter_returns_only_that_campaign(self):
        ids = self._ids(self.gm, f"/api/characters/?campaign={self.camp_a.id}")
        self.assertEqual(ids, {self.pc_a.id})

    def test_unfiltered_list_unchanged(self):
        ids = self._ids(self.gm, "/api/characters/")
        self.assertEqual(ids, {self.pc_a.id, self.pc_b.id})

    def test_filter_never_widens_permissions(self):
        ids = self._ids(self.outsider, f"/api/characters/?campaign={self.camp_a.id}")
        self.assertEqual(ids, set())

    def test_filter_combines_with_mine(self):
        ids = self._ids(
            self.player, f"/api/characters/?mine=true&campaign={self.camp_b.id}"
        )
        self.assertEqual(ids, {self.pc_b.id})

    def test_bad_campaign_id_returns_empty(self):
        ids = self._ids(self.gm, "/api/characters/?campaign=abc")
        self.assertEqual(ids, set())

    def test_detail_ignores_campaign_param(self):
        self.client.force_authenticate(user=self.gm)
        res = self.client.get(
            f"/api/characters/{self.pc_b.id}/?campaign={self.camp_a.id}"
        )
        self.assertEqual(res.status_code, 200)


class ExperienceTrackerSessionFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.player = User.objects.create_user(username="pl_x", password="pw")
        gm = User.objects.create_user(username="gm_x", password="pw")
        camp = Campaign.objects.create(name="X", gm=gm)
        self.pc = Character.objects.create(
            user=self.player, campaign=camp, true_name="PC X"
        )
        self.s1 = Session.objects.create(campaign=camp, name="S1")
        self.s2 = Session.objects.create(campaign=camp, name="S2")
        self.e1 = ExperienceTracker.objects.create(
            character=self.pc, session=self.s1, trigger="BELIEFS", xp_gained=1
        )
        self.e2 = ExperienceTracker.objects.create(
            character=self.pc, session=self.s2, trigger="BELIEFS", xp_gained=1
        )
        self.client.force_authenticate(user=self.player)

    def _ids(self, url):
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200, res.data)
        rows = res.data["results"] if isinstance(res.data, dict) else res.data
        return {row["id"] for row in rows}

    def test_session_filter(self):
        ids = self._ids(
            f"/api/experience-tracker/?character={self.pc.id}&session={self.s2.id}"
        )
        self.assertEqual(ids, {self.e2.id})

    def test_without_session_returns_all_for_character(self):
        ids = self._ids(f"/api/experience-tracker/?character={self.pc.id}")
        self.assertEqual(ids, {self.e1.id, self.e2.id})

    def test_bad_session_id_returns_empty(self):
        ids = self._ids(
            f"/api/experience-tracker/?character={self.pc.id}&session=nope"
        )
        self.assertEqual(ids, set())
