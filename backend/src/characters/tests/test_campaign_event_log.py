"""Numbered campaign events with replay (PR 6)."""

import json
import os
import re
import unittest
import uuid
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from knox.models import AuthToken

from characters import campaign_event_log
from characters.models import Campaign
from characters.realtime import broadcast_campaign_update


def _id_key(event_id):
    ms, seq = event_id.split("-")
    return (int(ms), int(seq))


class FakeStreamRedis:
    """The Redis calls realtime and campaign_event_log make (stream + pub/sub)."""

    def __init__(self):
        self.streams = {}
        self.ttls = {}
        self.published = []
        self.maxlens = {}
        self._ms = 1_700_000_000_000

    def xadd(self, key, fields, maxlen=None, approximate=True):
        self._ms += 1
        event_id = f"{self._ms}-0"
        entries = self.streams.setdefault(key, [])
        entries.append((event_id.encode(), {b"p": fields["p"].encode()}))
        self.maxlens[key] = maxlen
        if maxlen is not None and len(entries) > maxlen:
            del entries[: len(entries) - maxlen]
        return event_id.encode()

    def expire(self, key, seconds):
        self.ttls[key] = seconds

    def xrevrange(self, key, max="+", min="-", count=None):
        entries = list(reversed(self.streams.get(key, [])))
        return entries[:count] if count is not None else entries

    def xrange(self, key, min="-", max="+", count=None):
        entries = self.streams.get(key, [])
        out = []
        for eid, fields in entries:
            k = _id_key(eid.decode())
            if min.startswith("("):
                if k <= _id_key(min[1:]):
                    continue
            elif min != "-" and k < _id_key(min):
                continue
            out.append((eid, fields))
            if count is not None and len(out) >= count:
                break
        return out

    def publish(self, channel, body):
        self.published.append((channel, body))


class EventLogRedisTests(TestCase):
    def setUp(self):
        self.fake = FakeStreamRedis()
        p = patch("characters.realtime.get_redis_client", return_value=self.fake)
        p.start()
        self.addCleanup(p.stop)

    def test_broadcast_numbers_the_event_and_publishes_the_id(self):
        broadcast_campaign_update(7, "roll", character_id=3)
        (channel, body), = self.fake.published
        payload = json.loads(body)
        self.assertRegex(payload["id"], r"^\d+-\d+$")
        key = campaign_event_log.stream_key(7)
        self.assertEqual(self.fake.maxlens[key], 500)
        self.assertEqual(self.fake.ttls[key], 3600)

    def test_events_since_replays_only_later_events_in_order(self):
        for reason in ("a", "b", "c"):
            broadcast_campaign_update(7, reason)
        ids = [json.loads(b)["id"] for _, b in self.fake.published]
        events = campaign_event_log.events_since(7, ids[0])
        self.assertEqual([e["reason"] for e in events], ["b", "c"])
        self.assertEqual([e["id"] for e in events], ids[1:])

    def test_events_since_the_newest_is_empty_not_resync(self):
        broadcast_campaign_update(7, "a")
        newest = json.loads(self.fake.published[-1][1])["id"]
        self.assertEqual(campaign_event_log.events_since(7, newest), [])

    def test_id_older_than_the_buffer_needs_resync(self):
        broadcast_campaign_update(7, "first")
        first = json.loads(self.fake.published[0][1])["id"]
        with patch.object(campaign_event_log, "MAX_EVENTS", 2):
            for reason in ("b", "c", "d"):
                broadcast_campaign_update(7, reason)
        self.assertIsNone(campaign_event_log.events_since(7, first))

    def test_expired_log_needs_resync(self):
        self.assertIsNone(campaign_event_log.events_since(7, "1700000000001-0"))

    def test_newest_id_is_the_last_event(self):
        self.assertIsNone(campaign_event_log.newest_id(7))
        broadcast_campaign_update(7, "a")
        broadcast_campaign_update(7, "b")
        newest = json.loads(self.fake.published[-1][1])["id"]
        self.assertEqual(campaign_event_log.newest_id(7), newest)

    def test_bad_id_needs_resync(self):
        broadcast_campaign_update(7, "a")
        self.assertIsNone(campaign_event_log.events_since(7, "not-an-id"))
        self.assertIsNone(campaign_event_log.events_since(7, ""))

    def test_other_campaigns_are_separate(self):
        broadcast_campaign_update(7, "a")
        broadcast_campaign_update(8, "b")
        first = json.loads(self.fake.published[0][1])["id"]
        self.assertEqual(campaign_event_log.events_since(7, first), [])

    def test_log_failure_still_publishes_without_id(self):
        def boom(*a, **k):
            raise ConnectionError("redis down")

        self.fake.xadd = boom
        broadcast_campaign_update(7, "roll")
        payload = json.loads(self.fake.published[-1][1])
        self.assertNotIn("id", payload)
        self.assertEqual(payload["reason"], "roll")


class EventLogLocalTests(TestCase):
    """Without Redis (dev, tests): an in-process log with the same rules."""

    def setUp(self):
        campaign_event_log.reset_local_log()
        p = patch("characters.realtime.get_redis_client", return_value=None)
        p.start()
        self.addCleanup(p.stop)

    def test_local_ids_increase_and_replay(self):
        first = campaign_event_log.append_event(5, {"type": "campaign_update"})
        second = campaign_event_log.append_event(5, {"type": "campaign_update"})
        self.assertLess(_id_key(first), _id_key(second))
        self.assertEqual(
            [e["id"] for e in campaign_event_log.events_since(5, first)], [second]
        )

    def test_local_buffer_trims_and_resyncs(self):
        with patch.object(campaign_event_log, "MAX_EVENTS", 2):
            first = campaign_event_log.append_event(5, {"type": "campaign_update"})
            for _ in range(3):
                campaign_event_log.append_event(5, {"type": "campaign_update"})
        self.assertIsNone(campaign_event_log.events_since(5, first))


def _ticket(client, token, campaign_id):
    r = client.post(
        f"/api/campaigns/{campaign_id}/events/ticket/",
        HTTP_AUTHORIZATION=f"Token {token}",
    )
    return r.json()["ticket"]


@override_settings(SSE_STREAM_MAX_SECONDS=0.05, SSE_SLOT_CHECK_SECONDS=0.01)
class StreamReplayTests(TestCase):
    def setUp(self):
        from characters import sse_slots

        sse_slots._local_slots.clear()
        campaign_event_log.reset_local_log()
        p = patch("characters.realtime.get_redis_client", return_value=None)
        p.start()
        self.addCleanup(p.stop)
        self.client = Client()
        self.gm = User.objects.create_user("gm6", "gm6@example.com", "pw")
        self.player = User.objects.create_user("pl6", "pl6@example.com", "pw")
        self.campaign = Campaign.objects.create(name="Replay", gm=self.gm)
        self.campaign.players.add(self.player)
        self.token = AuthToken.objects.create(self.player)[1]

    def _stream(self, last_event_id=None):
        ticket = _ticket(self.client, self.token, self.campaign.id)
        url = f"/api/campaigns/{self.campaign.id}/events/?ticket={ticket}"
        if last_event_id is not None:
            url += f"&last_event_id={last_event_id}"
        r = self.client.get(url)
        self.assertEqual(r.status_code, 200)
        return b"".join(r.streaming_content).decode()

    def test_connected_frame_says_replay_is_supported(self):
        body = self._stream()
        self.assertIn('"type": "connected", "replay": true', body)

    def test_reconnect_replays_missed_events_with_ids(self):
        cid = self.campaign.id
        first = campaign_event_log.append_event(
            cid, {"type": "campaign_update", "reason": "seen"}
        )
        second = campaign_event_log.append_event(
            cid, {"type": "campaign_update", "reason": "missed", "character_id": 4}
        )
        body = self._stream(last_event_id=first)
        self.assertIn(f"id: {second}\n", body)
        self.assertIn('"reason": "missed"', body)
        self.assertNotIn('"reason": "seen"', body)
        self.assertNotIn('"resync"', body)

    def test_too_old_id_gets_resync(self):
        cid = self.campaign.id
        with patch.object(campaign_event_log, "MAX_EVENTS", 1):
            first = campaign_event_log.append_event(cid, {"type": "campaign_update"})
            campaign_event_log.append_event(cid, {"type": "campaign_update"})
        body = self._stream(last_event_id=first)
        self.assertIn('data: {"type": "resync"', body)

    def test_connected_frame_carries_the_newest_id(self):
        cid = self.campaign.id
        campaign_event_log.append_event(cid, {"type": "campaign_update"})
        newest = campaign_event_log.append_event(cid, {"type": "campaign_update"})
        body = self._stream()
        self.assertIn(f'"cursor": "{newest}"', body)

    def test_connected_frame_cursor_is_null_on_an_empty_log(self):
        body = self._stream()
        self.assertIn('"cursor": null', body)

    def test_resync_frame_carries_the_newest_id(self):
        cid = self.campaign.id
        with patch.object(campaign_event_log, "MAX_EVENTS", 1):
            first = campaign_event_log.append_event(cid, {"type": "campaign_update"})
            newest = campaign_event_log.append_event(cid, {"type": "campaign_update"})
        body = self._stream(last_event_id=first)
        self.assertIn(f'data: {{"type": "resync", "cursor": "{newest}"}}', body)

    def test_resync_on_an_expired_log_has_no_cursor(self):
        body = self._stream(last_event_id="1700000000001-0")
        self.assertIn('data: {"type": "resync", "cursor": null}', body)

    def test_no_last_event_id_means_no_replay(self):
        campaign_event_log.append_event(
            self.campaign.id, {"type": "campaign_update", "reason": "old"}
        )
        body = self._stream()
        self.assertNotIn('"reason": "old"', body)
        self.assertNotIn('"resync"', body)

    def test_live_event_already_replayed_is_not_sent_twice(self):
        import queue

        cid = self.campaign.id
        first = campaign_event_log.append_event(
            cid, {"type": "campaign_update", "reason": "seen"}
        )
        second = campaign_event_log.append_event(
            cid, {"type": "campaign_update", "reason": "replayed"}
        )
        # Published between subscribe and replay: it arrives live as well.
        live = queue.Queue()
        live.put({"type": "campaign_update", "reason": "replayed", "id": second})
        live.put({"type": "campaign_update", "reason": "new", "id": "0-99"})
        with patch("characters.views_sse.subscribe_campaign", return_value=live):
            body = self._stream(last_event_id=first)
        self.assertEqual(body.count('"reason": "replayed"'), 1)
        self.assertIn('"reason": "new"', body)

    def test_live_event_carries_its_id_line(self):
        from characters.views_sse import format_event

        frame = format_event({"type": "campaign_update", "id": "5-0"})
        self.assertTrue(frame.startswith("id: 5-0\ndata: "))
        self.assertTrue(re.match(r"^data: ", format_event({"type": "heartbeat"})))


@unittest.skipUnless(
    os.environ.get("TEST_REDIS_URL"), "TEST_REDIS_URL not set (CI runs Redis 7.0)"
)
class EventLogRealRedisTests(TestCase):
    """The real XADD / XRANGE / EXPIRE behaviour, against the same Redis major as prod."""

    def setUp(self):
        import redis

        self.redis = redis.Redis.from_url(os.environ["TEST_REDIS_URL"])
        prefix = f"test-pr6:{uuid.uuid4().hex}:"
        o = override_settings(REALTIME_CHANNEL_PREFIX=prefix)
        o.enable()
        self.addCleanup(o.disable)
        p = patch("characters.realtime.get_redis_client", return_value=self.redis)
        p.start()
        self.addCleanup(p.stop)
        self.addCleanup(
            lambda: [self.redis.delete(k) for k in self.redis.scan_iter(f"{prefix}*")]
        )

    def test_append_replay_and_ttl(self):
        ids = [
            campaign_event_log.append_event(3, {"type": "campaign_update", "reason": r})
            for r in ("a", "b", "c")
        ]
        events = campaign_event_log.events_since(3, ids[0])
        self.assertEqual([e["reason"] for e in events], ["b", "c"])
        self.assertEqual([e["id"] for e in events], ids[1:])
        self.assertEqual(campaign_event_log.events_since(3, ids[-1]), [])
        ttl = self.redis.ttl(campaign_event_log.stream_key(3))
        self.assertTrue(3500 < ttl <= 3600, ttl)

    def test_newest_id_against_real_redis(self):
        self.assertIsNone(campaign_event_log.newest_id(3))
        campaign_event_log.append_event(3, {"type": "campaign_update"})
        newest = campaign_event_log.append_event(3, {"type": "campaign_update"})
        self.assertEqual(campaign_event_log.newest_id(3), newest)

    def test_trimmed_id_needs_resync(self):
        with patch.object(campaign_event_log, "MAX_EVENTS", 5):
            first = campaign_event_log.append_event(3, {"type": "campaign_update"})
            # Approximate trimming drops whole internal nodes (100 entries).
            for _ in range(400):
                campaign_event_log.append_event(3, {"type": "campaign_update"})
        self.assertIsNone(campaign_event_log.events_since(3, first))

    def test_broadcast_publishes_the_id(self):
        pubsub = self.redis.pubsub(ignore_subscribe_messages=True)
        from characters.realtime import channel_name

        pubsub.subscribe(channel_name(3))
        pubsub.get_message(timeout=1)
        broadcast_campaign_update(3, "roll")
        msg = None
        for _ in range(20):
            msg = pubsub.get_message(timeout=0.5)
            if msg:
                break
        pubsub.close()
        self.assertIsNotNone(msg)
        self.assertRegex(json.loads(msg["data"])["id"], r"^\d+-\d+$")
