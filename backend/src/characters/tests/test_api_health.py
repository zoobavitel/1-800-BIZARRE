"""GET /api/health/ is the pool probe. It stays anonymous."""

from unittest.mock import patch

from django.db.utils import OperationalError
from django.test import TestCase


class HealthTests(TestCase):
    def test_anonymous_ok_when_database_answers(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["db"], "ok")
        self.assertIn(body["redis"], ("ok", "down", "unavailable"))

    def test_database_failure_is_503(self):
        with patch("app.health.connection.cursor", side_effect=OperationalError("down")):
            response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()["ok"])
        self.assertEqual(response.json()["db"], "down")
