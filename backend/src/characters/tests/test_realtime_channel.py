import os

from django.test import SimpleTestCase, override_settings

from characters.realtime import _redis_url, channel_name


class RealtimeChannelPrefixTests(SimpleTestCase):
    def test_live_default_prefix(self):
        self.assertEqual(channel_name(3), "bizarre:campaign:3")

    @override_settings(REALTIME_CHANNEL_PREFIX="perf:bizarre:campaign:")
    def test_perf_prefix_is_read_at_call_time(self):
        self.assertEqual(channel_name(3), "perf:bizarre:campaign:3")

    @override_settings(
        REALTIME_REDIS_URL="redis://127.0.0.1:6379/2",
        CELERY_BROKER_URL="amqp://guest@127.0.0.1:5672//",
    )
    def test_prod_reads_realtime_redis_url_not_the_broker(self):
        keys = (
            "REDIS_URL",
            "CHANNEL_REDIS_URL",
            "CELERY_BROKER_URL",
            "REALTIME_REDIS_URL",
        )
        saved = {key: os.environ.get(key) for key in keys}
        saved_module = os.environ.get("DJANGO_SETTINGS_MODULE")
        try:
            for key in keys:
                os.environ.pop(key, None)
            os.environ["DJANGO_SETTINGS_MODULE"] = "app.settings_prod"
            self.assertEqual(_redis_url(), "redis://127.0.0.1:6379/2")
        finally:
            for key, value in saved.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
            if saved_module is None:
                os.environ.pop("DJANGO_SETTINGS_MODULE", None)
            else:
                os.environ["DJANGO_SETTINGS_MODULE"] = saved_module
