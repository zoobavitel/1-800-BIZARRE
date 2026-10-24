"""Redis listener threads: a stream that subscribes while the last one leaves
still gets events."""

import json
import queue
import threading
import time
from unittest import mock

from django.test import SimpleTestCase

from characters import realtime


class FakeBus:
    """In-memory stand-in for Redis pub/sub."""

    def __init__(self):
        self.lock = threading.Lock()
        self.channels = {}

    def publish(self, channel, data):
        with self.lock:
            targets = list(self.channels.get(channel, []))
        for _owner, target in targets:
            target.put(data)
        return len(targets)

    def pubsub_client(self):
        return FakePubSubClient(self)


class FakePubSubClient:
    def __init__(self, bus):
        self.bus = bus

    def pubsub(self, ignore_subscribe_messages=True):
        return FakePubSub(self.bus)

    def close(self):
        pass


class FakePubSub:
    def __init__(self, bus):
        self.bus = bus
        self.inbox = queue.Queue()
        self.channel = None

    def subscribe(self, channel):
        self.channel = channel
        with self.bus.lock:
            self.bus.channels.setdefault(channel, []).append(
                (threading.current_thread(), self.inbox)
            )

    def get_message(self, ignore_subscribe_messages=True, timeout=1.0):
        # Short wait keeps the test fast; the listener loops either way.
        try:
            data = self.inbox.get(timeout=min(timeout, 0.02))
        except queue.Empty:
            return None
        return {"type": "message", "data": data}

    def unsubscribe(self, channel):
        with self.bus.lock:
            subs = self.bus.channels.get(channel, [])
            subs[:] = [s for s in subs if s[1] is not self.inbox]

    def close(self):
        pass


class FakePublishClient:
    def __init__(self, bus):
        self.bus = bus

    def publish(self, channel, data):
        return self.bus.publish(channel, data)


class RedisListenerRaceTests(SimpleTestCase):
    def setUp(self):
        self.bus = FakeBus()
        patches = [
            mock.patch.object(
                realtime, "get_redis_client", return_value=FakePublishClient(self.bus)
            ),
            mock.patch.object(
                realtime, "_redis_pubsub_client", side_effect=self.bus.pubsub_client
            ),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self._clear_registry)
        self._clear_registry()

    def _clear_registry(self):
        with realtime._lock:
            for stop in realtime._listener_stop.values():
                stop.set()
            realtime._subscribers.clear()
            realtime._listener_queues.clear()
            realtime._listener_threads.clear()
            realtime._listener_stop.clear()

    def _wait_for_listener_on_bus(self, cid, timeout=2.0):
        """Wait until the campaign's registered listener is on the bus."""
        channel = realtime.channel_name(cid)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            with realtime._lock:
                current = realtime._listener_threads.get(cid)
            with self.bus.lock:
                owners = [o for o, _ in self.bus.channels.get(channel, [])]
            if current is not None and current in owners:
                return
            time.sleep(0.005)
        self.fail("no registered listener on the bus")

    def _get(self, q, timeout=2.0):
        return q.get(timeout=timeout)

    def test_resubscribe_right_after_last_unsubscribe_gets_events(self):
        cid = 41
        # Repeat: the bad interleaving only shows up on some runs.
        for i in range(25):
            q1 = realtime.subscribe_campaign(cid)
            self._wait_for_listener_on_bus(cid)
            realtime.unsubscribe_campaign(cid, q1)
            q2 = realtime.subscribe_campaign(cid)
            self._wait_for_listener_on_bus(cid)
            realtime.broadcast_campaign_update(cid, "roll", character_id=i + 1)
            try:
                msg = self._get(q2)
            except queue.Empty:
                self.fail(f"run {i}: new stream attached to a leaving listener")
            self.assertEqual(msg["character_id"], i + 1)
            realtime.unsubscribe_campaign(cid, q2)

    def test_subscriber_arriving_after_exit_decision_gets_events(self):
        """A stream that subscribes after the listener decided to leave, but
        before its thread ended, must not attach to that thread.

        The old listener read its stop flag outside the lock, then removed
        itself from the registry later. HookedEvent runs a subscribe at the
        second unlocked read that returns True: the old loop's final exit
        check. The fixed listener only reads the flag under the lock, so the
        hook never fires there and the subscribe runs after the exit instead.
        """
        cid = 45
        late = {}
        unlocked_true_reads = {"n": 0}

        def subscribe_late():
            late["q"] = realtime.subscribe_campaign(cid)

        class HookedEvent(threading.Event):
            def is_set(self):
                value = super().is_set()
                if (
                    value
                    and "q" not in late
                    and threading.current_thread().name.startswith("sse-redis-")
                    and not realtime._lock.locked()
                ):
                    unlocked_true_reads["n"] += 1
                    if unlocked_true_reads["n"] == 2:
                        subscribe_late()
                return value

        with mock.patch.object(realtime.threading, "Event", HookedEvent):
            q1 = realtime.subscribe_campaign(cid)
        with realtime._lock:
            old = realtime._listener_threads[cid]
        self._wait_for_listener_on_bus(cid)
        realtime.unsubscribe_campaign(cid, q1)
        old.join(timeout=2.0)
        self.assertFalse(old.is_alive())
        if "q" not in late:
            subscribe_late()
        self._wait_for_listener_on_bus(cid)
        realtime.broadcast_campaign_update(cid, "roll", character_id=7)
        try:
            msg = self._get(late["q"], timeout=1.0)
        except queue.Empty:
            self.fail("stream attached to a listener that was leaving")
        self.assertEqual(msg["character_id"], 7)
        realtime.unsubscribe_campaign(cid, late["q"])

    def test_last_unsubscribe_deregisters_listener(self):
        cid = 42
        q = realtime.subscribe_campaign(cid)
        with realtime._lock:
            thread = realtime._listener_threads[cid]
        realtime.unsubscribe_campaign(cid, q)
        thread.join(timeout=2.0)
        self.assertFalse(thread.is_alive())
        with realtime._lock:
            self.assertNotIn(cid, realtime._listener_threads)
            self.assertNotIn(cid, realtime._listener_stop)

    def test_leaving_listener_does_not_remove_its_replacement(self):
        cid = 43
        q1 = realtime.subscribe_campaign(cid)
        with realtime._lock:
            old = realtime._listener_threads[cid]
        realtime.unsubscribe_campaign(cid, q1)
        old.join(timeout=2.0)
        q2 = realtime.subscribe_campaign(cid)
        with realtime._lock:
            new = realtime._listener_threads[cid]
        self.assertIsNot(new, old)
        self._wait_for_listener_on_bus(cid)
        realtime.broadcast_campaign_update(cid, "progress_clock")
        self.assertEqual(self._get(q2)["reason"], "progress_clock")
        realtime.unsubscribe_campaign(cid, q2)

    def test_bad_payload_becomes_full_update(self):
        cid = 44
        q = realtime.subscribe_campaign(cid)
        channel = realtime.channel_name(cid)
        self._wait_for_listener_on_bus(cid)
        self.bus.publish(channel, b"not json")
        self.assertEqual(self._get(q), {"type": "campaign_update", "reason": "update"})
        self.bus.publish(channel, json.dumps({"type": "campaign_update", "reason": "npc"}))
        self.assertEqual(self._get(q)["reason"], "npc")
        realtime.unsubscribe_campaign(cid, q)
