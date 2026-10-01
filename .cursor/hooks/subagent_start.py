#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ask, allow, read_stdin_json  # noqa: E402

# Read-only / narrow agents — allow without friction
ALLOW = {
    "explore",
    "cursor-guide",
    "bizarre-srd-alignment",
    "srd-alignment-spot-check",
    "plan-deduplicator",
    "api-parity-checker",
    "migration-sanity",
    "django-schema-impact",
    "codebase-docs-maintainer",
    "test-coverage-auditor",
}

# Can run shell or mutate remote — ask
ASK = {
    "shell",
    "generalPurpose",
    "best-of-n-runner",
    "dev-server-starter",
    "security-hardening-web",
    "feature-branch-git",
    "ci-investigator",
    "bugbot",
    "security-review",
    "test-runner-django-frontend",
}


def main() -> None:
    data = read_stdin_json()
    kind = str(
        data.get("subagent_type")
        or data.get("subagentType")
        or data.get("agent_type")
        or data.get("type")
        or ""
    )
    if kind in ALLOW:
        allow()
    if kind in ASK or not kind:
        ask(
            f"Start subagent `{kind or 'unknown'}`?",
            "Confirm before spawning a shell-capable or mutating subagent.",
        )
    ask(f"Unknown subagent type `{kind}` — confirm before start")


if __name__ == "__main__":
    main()
