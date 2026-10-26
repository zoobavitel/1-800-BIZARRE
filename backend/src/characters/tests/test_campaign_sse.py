"""Campaign SSE endpoint: ticket auth and GM/player access."""

from django.test import Client, TestCase, override_settings
from django.contrib.auth.models import User
from knox.models import AuthToken

from characters.models import Campaign


def stream_path(client, token, campaign_id):
    """Stream URL with a fresh one-use ticket, the way the frontend opens it."""
    r = client.post(
        f"/api/campaigns/{campaign_id}/events/ticket/",
        HTTP_AUTHORIZATION=f"Token {token}",
    )
    assert r.status_code == 200, r.status_code
    return f"/api/campaigns/{campaign_id}/events/?ticket={r.json()['ticket']}"


class CampaignSSEViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.gm = User.objects.create_user("gm", "gm@example.com", "pw")
        self.player = User.objects.create_user("pl", "pl@example.com", "pw")
        self.stranger = User.objects.create_user("st", "st@example.com", "pw")
        self.campaign = Campaign.objects.create(name="Test", gm=self.gm)
        self.campaign.players.add(self.player)
        self.player_token = AuthToken.objects.create(self.player)[1]
        self.stranger_token = AuthToken.objects.create(self.stranger)[1]

    def test_events_401_without_ticket(self):
        r = self.client.get(f"/api/campaigns/{self.campaign.id}/events/")
        self.assertEqual(r.status_code, 401)

    def test_login_token_in_url_is_rejected(self):
        """The login token never opens a stream: access logs record URLs."""
        r = self.client.get(
            f"/api/campaigns/{self.campaign.id}/events/?token={self.player_token}"
        )
        self.assertEqual(r.status_code, 401)

    def test_non_member_cannot_get_ticket(self):
        r = self.client.post(
            f"/api/campaigns/{self.campaign.id}/events/ticket/",
            HTTP_AUTHORIZATION=f"Token {self.stranger_token}",
        )
        self.assertEqual(r.status_code, 403)

    def test_events_200_for_player(self):
        r = self.client.get(
            stream_path(self.client, self.player_token, self.campaign.id)
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
            stream_path(self.client, self.player_token, self.campaign.id)
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
        self.token = AuthToken.objects.create(self.player)[1]

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

        r = self.client.get(stream_path(self.client, self.token, self.campaign.id))
        self.assertEqual(r.status_code, 200)
        # Two newer streams from the same user push the first past the cap.
        claim_slot(self.player.id, self.campaign.id)
        claim_slot(self.player.id, self.campaign.id)
        started = time.monotonic()
        body = b"".join(r.streaming_content).decode()
        self.assertLess(time.monotonic() - started, 2)
        self.assertIn('"type": "connected"', body)
        # Tell the client it was replaced, so it stops instead of reconnecting
        # and evicting another of its own streams (PR 5a).
        self.assertTrue(body.rstrip().endswith('data: {"type": "evicted"}'), body)

    @override_settings(
        SSE_STREAM_MAX_SECONDS=0.05,
        SSE_HEARTBEAT_SECONDS=10,
        SSE_SLOT_CHECK_SECONDS=0.01,
    )
    def test_stream_that_times_out_is_not_marked_evicted(self):
        r = self.client.get(stream_path(self.client, self.token, self.campaign.id))
        body = b"".join(r.streaming_content).decode()
        self.assertIn('"type": "connected"', body)
        self.assertNotIn('"evicted"', body)


class FakeTicketRedis:
    """Just the Redis calls sse_tickets makes."""

    def __init__(self):
        self.data = {}
        self.ttls = {}

    def set(self, key, value, ex=None):
        self.data[key] = value.encode()
        self.ttls[key] = ex

    def getdel(self, key):
        return self.data.pop(key, None)


@override_settings(
    SSE_STREAM_MAX_SECONDS=0.05,
    SSE_HEARTBEAT_SECONDS=0.01,
)
class SSETicketTests(TestCase):
    """The stream opens with a one-use ticket, so the login token stays out of URLs."""

    def setUp(self):
        from characters import sse_tickets

        sse_tickets._local_tickets.clear()
        self.client = Client()
        self.gm = User.objects.create_user("gm3", "gm3@example.com", "pw")
        self.player = User.objects.create_user("pl3", "pl3@example.com", "pw")
        self.stranger = User.objects.create_user("st3", "st3@example.com", "pw")
        self.campaign = Campaign.objects.create(name="Ticket", gm=self.gm)
        self.campaign.players.add(self.player)
        self.other = Campaign.objects.create(name="Other", gm=self.player)
        self.player_token = AuthToken.objects.create(self.player)[1]
        self.stranger_token = AuthToken.objects.create(self.stranger)[1]

    def _ticket(self, token, campaign_id=None):
        cid = campaign_id or self.campaign.id
        return self.client.post(
            f"/api/campaigns/{cid}/events/ticket/",
            HTTP_AUTHORIZATION=f"Token {token}",
        )

    def _stream(self, ticket, campaign_id=None):
        cid = campaign_id or self.campaign.id
        return self.client.get(f"/api/campaigns/{cid}/events/?ticket={ticket}")

    def test_valid_ticket_streams(self):
        r = self._ticket(self.player_token)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Cache-Control"], "no-store")
        s = self._stream(r.json()["ticket"])
        self.assertEqual(s.status_code, 200)
        self.assertIn('"type": "connected"', b"".join(s.streaming_content).decode())

    def test_gm_gets_ticket(self):
        gm_token = AuthToken.objects.create(self.gm)[1]
        self.assertEqual(self._ticket(gm_token).status_code, 200)

    def test_reused_ticket_401(self):
        ticket = self._ticket(self.player_token).json()["ticket"]
        first = self._stream(ticket)
        b"".join(first.streaming_content)
        self.assertEqual(self._stream(ticket).status_code, 401)

    def test_expired_ticket_401(self):
        from unittest import mock

        from characters import sse_tickets

        ticket = self._ticket(self.player_token).json()["ticket"]
        later = sse_tickets.time.monotonic() + sse_tickets.ticket_ttl_seconds() + 1
        with mock.patch.object(sse_tickets.time, "monotonic", return_value=later):
            self.assertEqual(self._stream(ticket).status_code, 401)

    def test_other_campaign_ticket_401_and_spent(self):
        ticket = self._ticket(self.player_token, self.other.id).json()["ticket"]
        self.assertEqual(self._stream(ticket).status_code, 401)
        # The mismatch spends it, so it cannot be tried again on its own campaign.
        self.assertEqual(self._stream(ticket, self.other.id).status_code, 401)

    def test_unknown_or_empty_ticket_401(self):
        self.assertEqual(self._stream("nope").status_code, 401)
        self.assertEqual(self._stream("").status_code, 401)

    def test_bad_ticket_does_not_fall_back_to_token(self):
        r = self.client.get(
            f"/api/campaigns/{self.campaign.id}/events/"
            f"?ticket=nope&token={self.player_token}"
        )
        self.assertEqual(r.status_code, 401)

    def test_non_member_403_at_issue(self):
        self.assertEqual(self._ticket(self.stranger_token).status_code, 403)

    def test_missing_campaign_404_at_issue(self):
        self.assertEqual(self._ticket(self.player_token, 999999).status_code, 404)

    def test_ticket_needs_login(self):
        r = self.client.post(f"/api/campaigns/{self.campaign.id}/events/ticket/")
        self.assertIn(r.status_code, (401, 403))

    def test_ticket_rejects_get(self):
        r = self.client.get(
            f"/api/campaigns/{self.campaign.id}/events/ticket/",
            HTTP_AUTHORIZATION=f"Token {self.player_token}",
        )
        self.assertEqual(r.status_code, 405)

    def test_removed_player_403_at_stream(self):
        ticket = self._ticket(self.player_token).json()["ticket"]
        self.campaign.players.remove(self.player)
        self.assertEqual(self._stream(ticket).status_code, 403)

    def test_redis_ticket_single_use_with_ttl(self):
        from unittest import mock

        from characters import sse_tickets

        fake = FakeTicketRedis()
        with mock.patch.object(sse_tickets, "get_redis_client", return_value=fake):
            ticket = sse_tickets.issue_ticket(self.player.id, self.campaign.id)
            key = sse_tickets._key(ticket)
            self.assertEqual(fake.ttls[key], 60)
            self.assertEqual(
                sse_tickets.redeem_ticket(ticket), (self.player.id, self.campaign.id)
            )
            self.assertIsNone(sse_tickets.redeem_ticket(ticket))
