"""Campaign SSE endpoint: token auth and GM/player access."""

from django.test import Client, TestCase, override_settings
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

from characters.models import Campaign


class CampaignSSEViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.gm = User.objects.create_user("gm", "gm@example.com", "pw")
        self.player = User.objects.create_user("pl", "pl@example.com", "pw")
        self.stranger = User.objects.create_user("st", "st@example.com", "pw")
        self.campaign = Campaign.objects.create(name="Test", gm=self.gm)
        self.campaign.players.add(self.player)
        self.player_token = Token.objects.create(user=self.player)
        self.stranger_token = Token.objects.create(user=self.stranger)

    def test_events_401_without_token(self):
        r = self.client.get(f"/api/campaigns/{self.campaign.id}/events/")
        self.assertEqual(r.status_code, 401)

    def test_events_403_for_non_member(self):
        r = self.client.get(
            f"/api/campaigns/{self.campaign.id}/events/?token={self.stranger_token.key}"
        )
        self.assertEqual(r.status_code, 403)

    def test_events_200_for_player(self):
        r = self.client.get(
            f"/api/campaigns/{self.campaign.id}/events/?token={self.player_token.key}"
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/event-stream", r.get("Content-Type", ""))

    @override_settings(
        SSE_STREAM_MAX_SECONDS=0.05,
        SSE_HEARTBEAT_SECONDS=0.01,
        SSE_CLIENT_RETRY_MS=2000,
    )
    def test_stream_sends_retry_and_closes(self):
        r = self.client.get(
            f"/api/campaigns/{self.campaign.id}/events/?token={self.player_token.key}"
        )
        self.assertEqual(r.status_code, 200)
        body = b"".join(r.streaming_content).decode()
        self.assertIn("retry: 2000", body)
        self.assertIn('"type": "connected"', body)


@override_settings(SSE_MAX_STREAMS_PER_USER=2)
class SSEStreamCapTests(TestCase):
    """One user cannot pin unbounded gunicorn threads with stale streams."""

    def setUp(self):
        from characters import sse_slots

        sse_slots._local_slots.clear()
        self.client = Client()
        self.gm = User.objects.create_user("gm2", "gm2@example.com", "pw")
        self.player = User.objects.create_user("pl2", "pl2@example.com", "pw")
        self.campaign = Campaign.objects.create(name="Cap", gm=self.gm)
        self.campaign.players.add(self.player)
        self.token = Token.objects.create(user=self.player)

    def test_newest_streams_keep_slots_oldest_evicted(self):
        from characters.sse_slots import claim_slot, holds_slot, release_slot

        cid = self.campaign.id
        a = claim_slot(self.player.id, cid)
        b = claim_slot(self.player.id, cid)
        c = claim_slot(self.player.id, cid)
        self.assertFalse(holds_slot(self.player.id, cid, a))
        self.assertTrue(holds_slot(self.player.id, cid, b))
        self.assertTrue(holds_slot(self.player.id, cid, c))
        # Other users and campaigns are unaffected.
        g = claim_slot(self.gm.id, cid)
        self.assertTrue(holds_slot(self.gm.id, cid, g))
        self.assertTrue(holds_slot(self.player.id, cid, c))
        release_slot(self.player.id, cid, c)
        self.assertFalse(holds_slot(self.player.id, cid, c))

    @override_settings(
        SSE_STREAM_MAX_SECONDS=30,
        SSE_HEARTBEAT_SECONDS=10,
        SSE_SLOT_CHECK_SECONDS=0.01,
    )
    def test_evicted_stream_ends_early(self):
        import time

        from characters.sse_slots import claim_slot

        r = self.client.get(
            f"/api/campaigns/{self.campaign.id}/events/?token={self.token.key}"
        )
        self.assertEqual(r.status_code, 200)
        # Two newer streams from the same user push the first past the cap.
        claim_slot(self.player.id, self.campaign.id)
        claim_slot(self.player.id, self.campaign.id)
        started = time.monotonic()
        body = b"".join(r.streaming_content).decode()
        self.assertLess(time.monotonic() - started, 2)
        self.assertIn('"type": "connected"', body)
