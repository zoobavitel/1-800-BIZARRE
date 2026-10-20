"""Pool floor and scale decisions. No systemd."""

from django.test import SimpleTestCase

from app.ha_scale import (
    HIGH_CONNS,
    LOW_TICKS,
    decide,
    instances_in_caddyfile,
    render_caddyfile,
)


class HaScaleTests(SimpleTestCase):
    def test_missing_floor_starts_immediately(self):
        action, instance, state = decide([1], {1: 0}, {"high_streak": 9, "low_streak": {}})
        self.assertEqual((action, instance), ("start", 2))
        self.assertEqual(state["high_streak"], 0)

    def test_empty_pool_starts_instance_one(self):
        action, instance, _state = decide([], {}, {"high_streak": 0, "low_streak": {}})
        self.assertEqual((action, instance), ("start", 1))

    def test_one_busy_sample_does_not_scale_out(self):
        busy = {1: HIGH_CONNS, 2: HIGH_CONNS}
        action, instance, state = decide([1, 2], busy, {"high_streak": 0, "low_streak": {}})
        self.assertEqual((action, instance), ("hold", None))
        self.assertEqual(state["high_streak"], 1)

    def test_second_busy_sample_starts_next_hole(self):
        busy = {1: HIGH_CONNS, 2: HIGH_CONNS, 4: HIGH_CONNS}
        action, instance, state = decide(
            [1, 2, 4], busy, {"high_streak": 1, "low_streak": {}}
        )
        self.assertEqual((action, instance), ("start", 3))
        self.assertEqual(state["high_streak"], 0)

    def test_full_pool_holds_when_busy(self):
        busy = {i: HIGH_CONNS for i in (1, 2, 3, 4)}
        action, instance, _state = decide(
            [1, 2, 3, 4], busy, {"high_streak": 50, "low_streak": {}}
        )
        self.assertEqual((action, instance), ("hold", None))

    def test_idle_extra_stops_only_after_the_low_streak(self):
        idle = {"high_streak": 0, "low_streak": {3: LOW_TICKS - 1}}
        action, instance, state = decide([1, 2, 3], {1: 0, 2: 0, 3: 0}, idle)
        self.assertEqual((action, instance), ("stop", 3))
        self.assertNotIn(3, state["low_streak"])

    def test_floor_never_scales_in(self):
        action, instance, _state = decide(
            [1, 2],
            {1: 0, 2: 0},
            {"high_streak": 0, "low_streak": {1: 100, 2: 100}},
        )
        self.assertEqual((action, instance), ("hold", None))

    def test_caddyfile_lists_only_the_given_instances(self):
        text = render_caddyfile([1, 2])
        self.assertEqual(instances_in_caddyfile(text), [1, 2])
        self.assertIn("127.0.0.1:8001", text)
        self.assertIn("127.0.0.1:8002", text)
        self.assertNotIn("127.0.0.1:8003", text)
        self.assertIn("lb_policy least_conn", text)
        self.assertIn("flush_interval -1", text)
        self.assertIn("lb_try_duration 5s", text)
        self.assertNotIn("keepalive", text)
