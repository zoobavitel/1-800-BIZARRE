"""Campaign updates name the row that changed, so clients refetch only that row."""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from characters.models import Campaign, Character, ExperienceTracker, Heritage
from characters.realtime import broadcast_campaign_update


class RealtimePayloadTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="pc", password="pass")
        self.gm = User.objects.create_user(username="gm", password="pass")
        self.heritage = Heritage.objects.create(
            name="Human", base_hp=0, description="Test"
        )
        self.campaign = Campaign.objects.create(
            name="Camp", gm=self.gm, description="Test"
        )
        self.character = Character.objects.create(
            user=self.user,
            true_name="Payload PC",
            heritage=self.heritage,
            campaign=self.campaign,
        )

    def _calls_for(self, action):
        with patch(
            "characters.signals_realtime.broadcast_campaign_update"
        ) as sent, self.captureOnCommitCallbacks(execute=True):
            action()
        return [c for c in sent.call_args_list]

    def test_character_save_names_character(self):
        calls = self._calls_for(self.character.save)
        self.assertTrue(calls)
        args, kwargs = calls[-1]
        self.assertEqual(args, (self.campaign.id, "character"))
        self.assertEqual(kwargs["character_id"], self.character.id)

    def test_experience_tracker_names_character(self):
        calls = self._calls_for(
            lambda: ExperienceTracker.objects.create(
                character=self.character,
                trigger="BELIEFS",
                description="test",
                xp_gained=1,
                award_source="GM",
                clock_key="playbook",
            )
        )
        tracker_calls = [c for c in calls if c.args[1] == "experience_tracker"]
        self.assertEqual(len(tracker_calls), 1)
        self.assertEqual(tracker_calls[0].kwargs["character_id"], self.character.id)


class BroadcastPayloadShapeTests(TestCase):
    def test_ids_added_only_when_given(self):
        with patch("characters.realtime.get_redis_client", return_value=None), patch(
            "characters.realtime._subscribers", {7: []}
        ):
            # No subscribers: just must not raise without ids.
            broadcast_campaign_update(7, "campaign")

    def test_payload_carries_ids(self):
        class FakeRedis:
            def __init__(self):
                self.sent = []

            def publish(self, channel, body):
                self.sent.append(body)

        fake = FakeRedis()
        with patch("characters.realtime.get_redis_client", return_value=fake):
            broadcast_campaign_update(7, "roll", character_id=3, session_id=9)
            broadcast_campaign_update(7, "campaign")
        self.assertIn('"character_id": 3', fake.sent[0])
        self.assertIn('"session_id": 9', fake.sent[0])
        self.assertNotIn("character_id", fake.sent[1])
