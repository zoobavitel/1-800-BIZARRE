#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ask, allow, deny, looks_like_secret_path, read_stdin_json  # noqa: E402


def main() -> None:
    data = read_stdin_json()
    path = (
        data.get("file_path")
        or data.get("path")
        or data.get("filePath")
        or ""
    )
    if not path:
        allow()

    s = str(path).replace("\\", "/")
    if "/etc/bizarre/" in s or s.endswith("prod.env") or "/opt/bizarre-prod/" in s and s.endswith(".env"):
        deny(
            f"Refusing to read prod secrets path: {path}",
            "Agent must not read prod.env or /etc/bizarre secrets.",
        )

    if looks_like_secret_path(s):
        # Private keys / credential dumps
        if any(x in s for x in ("id_rsa", "id_ed25519", ".pem", "credentials.json")):
            deny(f"Refusing to read credential file: {path}")
        ask(
            f"Reading possible secret file: {path}",
            "Confirm before exposing secrets into agent context.",
        )

    allow()


if __name__ == "__main__":
    main()
