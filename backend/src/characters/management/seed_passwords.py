"""Passwords for dev/test seed commands.

Never hardcode seed passwords in the repo: it's public. Set SEED_PASSWORD to
choose one, otherwise each run makes a random one and prints it once.
"""

import os
import secrets


def seed_password(stdout=None, username=""):
    """Return $SEED_PASSWORD, or a new random password (printed to stdout)."""
    value = os.environ.get("SEED_PASSWORD")
    if value:
        return value
    value = secrets.token_urlsafe(12)
    if stdout is not None:
        who = f" for {username}" if username else ""
        stdout.write(f"Random password{who}: {value} (set SEED_PASSWORD to choose one)")
    return value
