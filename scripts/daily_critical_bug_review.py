#!/usr/bin/env python3
"""Daily critical bug review over recent commits."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import textwrap
import urllib.error
import urllib.request


SINCE_WINDOW = os.getenv("REVIEW_SINCE_WINDOW", "26 hours ago")
MODEL = os.getenv("REVIEW_MODEL", "gpt-4.1-mini")
MAX_DIFF_CHARS = int(os.getenv("REVIEW_MAX_DIFF_CHARS", "180000"))


def run(cmd: list[str]) -> str:
    out = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return out.stdout.strip()


def get_recent_commits() -> str:
    return run(
        [
            "git",
            "log",
            f"--since={SINCE_WINDOW}",
            "--pretty=format:%H%x09%ad%x09%an%x09%s",
            "--date=iso",
        ]
    )


def get_recent_diff() -> str:
    return run(["git", "log", f"--since={SINCE_WINDOW}", "-p", "--no-color"])


def build_prompt(commits: str, diff_text: str, standards: str) -> str:
    return textwrap.dedent(
        f"""
        You are a deep bug-finding automation focused on high-severity issues.

        Goal:
        Inspect recent commits and identify critical correctness bugs that escaped review.
        Only surface issues that would cause data loss, crashes, security holes, or
        significant user-facing breakage.

        Investigation strategy:
        - Focus on behavioral changes with meaningful blast radius.
        - Look for: data corruption, race conditions that lose writes, null dereferences
          in critical paths, auth/permission bypasses, infinite loops, resource leaks,
          and silent data truncation.
        - Trace through the full code path — do not pattern-match only on diff.
        - Ignore style issues, minor edge cases, and theoretical concerns.

        Confidence bar:
        - Must describe a concrete trigger scenario for each bug.
        - If no plausible trigger scenario, do not report as bug.
        - If in doubt, return no critical bugs.

        Fix strategy:
        - If a critical bug exists, suggest minimal high-confidence fix and tests.
        - Avoid broad refactors.

        Output:
        - If fixed/suggested: Bug and impact, Root cause, Fix and validation performed.
        - If no critical bug found: "No critical bugs found."

        Repo standards:
        {standards}

        Recent commits:
        {commits}

        Unified diff:
        {diff_text}
        """
    ).strip()


def call_openai(prompt: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return (
            "No critical bugs found.\n\n"
            "_Automation note: `OPENAI_API_KEY` missing. Review skipped._"
        )

    body = {
        "model": MODEL,
        "input": prompt,
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        return f"No critical bugs found.\n\n_Automation error: {exc}_"

    if "output_text" in payload and payload["output_text"]:
        return payload["output_text"].strip()

    # Fallback for API shape changes.
    try:
        for item in payload.get("output", []):
            for part in item.get("content", []):
                text = part.get("text")
                if text:
                    return text.strip()
    except Exception:
        pass
    return "No critical bugs found.\n\n_Automation note: empty model response._"


def main() -> int:
    try:
        commits = get_recent_commits()
    except subprocess.CalledProcessError as exc:
        print(f"Review failed while reading commits: {exc}", file=sys.stderr)
        return 1

    if not commits:
        print("No critical bugs found.\n\n_No recent commits in review window._")
        return 0

    try:
        diff_text = get_recent_diff()
        standards = open("BUGBOT.md", "r", encoding="utf-8").read().strip()
    except (subprocess.CalledProcessError, OSError) as exc:
        print(f"Review failed while reading inputs: {exc}", file=sys.stderr)
        return 1

    if len(diff_text) > MAX_DIFF_CHARS:
        diff_text = diff_text[:MAX_DIFF_CHARS] + "\n\n[diff truncated]"

    prompt = build_prompt(commits, diff_text, standards)
    result = call_openai(prompt)
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
