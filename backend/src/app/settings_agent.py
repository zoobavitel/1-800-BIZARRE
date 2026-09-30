# Agent-workspace Django settings (Postgres clone — NOT production).
#
# On /opt/bizarre, manage.py defaults to this module. Prod units set
# DJANGO_SETTINGS_MODULE=app.settings_prod explicitly.
#
# Default DB_NAME is bizarre_db_dev. Connecting to the prod DB requires
# ALLOW_PROD_DB=1 (mid-session restore only).
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from decouple import Config, Csv, RepositoryEnv

_ENV_FILE = os.environ.get(
    "BIZARRE_ENV_FILE",
    str(Path(__file__).resolve().parent.parent / ".env"),
)
if os.path.isfile(_ENV_FILE):
    config = Config(RepositoryEnv(_ENV_FILE))
else:
    from decouple import config  # noqa: F811

from .settings import *

DEBUG = config("DEBUG", default=True, cast=bool)
SECRET_KEY = config("SECRET_KEY", default="agent-dev-insecure-change-me")

ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1,0.0.0.0",
    cast=Csv(),
)

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000",
    cast=Csv(),
)

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="bizarre_db_dev"),
        "USER": config("DB_USER", default="bizarre"),
        "PASSWORD": config("DB_PASSWORD", default=""),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
    }
}

_prod_db = config("PROD_DB_NAME", default="bizarre_db")
_allow_prod = config("ALLOW_PROD_DB", default=False, cast=bool)
if DATABASES["default"]["NAME"] == _prod_db and not _allow_prod:
    raise ImproperlyConfigured(
        f"settings_agent refuses DB_NAME={_prod_db!r} (production). "
        "Use bizarre_db_dev for normal agent work, or set ALLOW_PROD_DB=1 "
        "only when you intentionally need live data (e.g. mid-session restore)."
    )

CORS_ALLOW_CREDENTIALS = True

MEDIA_URL = "/media/"
# Agent uploads stay out of prod media unless you deliberately set MEDIA_ROOT.
MEDIA_ROOT = config(
    "MEDIA_ROOT",
    default=str(Path(BASE_DIR) / "media"),
)

CELERY_BROKER_URL = config("REDIS_URL", default="redis://127.0.0.1:6379/1")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default=CELERY_BROKER_URL)
CELERY_TASK_ALWAYS_EAGER = config(
    "CELERY_TASK_ALWAYS_EAGER", default=True, cast=bool
)

CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000",
    cast=Csv(),
)
