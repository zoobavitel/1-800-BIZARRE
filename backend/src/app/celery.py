"""Celery application (optional; add @shared_task in apps when needed)."""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")

app = Celery("jojo_ttrpg")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
