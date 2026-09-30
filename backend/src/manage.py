#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
from pathlib import Path


def _default_settings_module() -> str:
    """Agent tree on bizarre-api → settings_agent; elsewhere → sqlite settings.

    CI and local tests set DJANGO_SETTINGS_MODULE=app.settings explicitly.
    Prod gunicorn/celery set app.settings_prod on the unit — never this default.
    """
    repo_root = Path(__file__).resolve().parents[2]
    if repo_root == Path("/opt/bizarre"):
        return "app.settings_agent"
    return "app.settings"


def main():
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", _default_settings_module())
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
