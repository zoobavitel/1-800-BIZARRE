from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, Session


class SessionListCampaignFilterTests(TestCase):
    """The /api/sessions/ list must respect ?campaign=<id>.

    Without this filter, a user who GMs multiple campaigns would see every
    campaign's sessions in each campaign's list view, so creating or deleting
    a session in one campaign would visibly leak into another campaign's UI.
    """

    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm_filter", password="pw")
        self.campaign_a = Campaign.objects.create(name="Camp A", gm=self.gm)
        self.campaign_b = Campaign.objects.create(name="Camp B", gm=self.gm)
        self.session_a1 = Session.objects.create(
            campaign=self.campaign_a, name="A-1"
        )
        self.session_a2 = Session.objects.create(
            campaign=self.campaign_a, name="A-2"
        )
        self.session_b1 = Session.objects.create(
            campaign=self.campaign_b, name="B-1"
        )

    def _ids(self, response):
        data = response.data
        results = data["results"] if isinstance(data, dict) and "results" in data else data
        return sorted(item["id"] for item in results)

    def test_list_filters_by_campaign(self):
        self.client.force_authenticate(user=self.gm)

        res_a = self.client.get(f"/api/sessions/?campaign={self.campaign_a.id}")
        self.assertEqual(res_a.status_code, 200, res_a.data)
        self.assertEqual(
            self._ids(res_a),
            sorted([self.session_a1.id, self.session_a2.id]),
        )

        res_b = self.client.get(f"/api/sessions/?campaign={self.campaign_b.id}")
        self.assertEqual(res_b.status_code, 200, res_b.data)
        self.assertEqual(self._ids(res_b), [self.session_b1.id])

    def test_list_without_campaign_returns_all_visible(self):
        self.client.force_authenticate(user=self.gm)
        res = self.client.get("/api/sessions/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(
            self._ids(res),
            sorted(
                [self.session_a1.id, self.session_a2.id, self.session_b1.id]
            ),
        )
