#!/usr/bin/env python3
"""Shared helpers for 1-800-BIZARRE Cursor agent safety hooks."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = Path(os.environ.get("CURSOR_PROJECT_DIR") or REPO_ROOT).resolve()

# Paths agents must never mutate / rarely read
PROTECTED_WRITE_PREFIXES = (
    ".cursor/hooks.json",
    ".cursor/hooks/",
)
PROTECTED_RULE_PREFIXES = (".cursor/rules/",)

SECRET_BASENAMES = {
    "prod.env",
    ".env",
    ".env.prod",
    "id_rsa",
    "id_ed25519",
    "credentials.json",
}
SECRET_PATH_SNIPPETS = (
    "/etc/bizarre/",
    "/.ssh/",
    "prod.env",
)

PROD_PATH_SNIPPETS = (
    "/opt/bizarre-prod",
    "/var/lib/bizarre",
    "/etc/bizarre",
)

SSH_ALLOW_HOSTS = (
    "bizarre-api-agent",
    "agent@bizarre-api",
)

SSH_DENY_PATTERNS = (
    r"\bssh\b.*\b(pve2|pve|proxmox)\b",
    r"\bssh\b.*\broot@",
    r"\bpct\s+(enter|destroy|stop|start)\b",
    r"\bvz?dump\b",
)


def read_stdin_json() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"_raw": raw}
    return data if isinstance(data, dict) else {"_value": data}


def emit(permission: str, user_message: str = "", agent_message: str = "", **extra: Any) -> None:
    out: dict[str, Any] = {"permission": permission}
    if user_message:
        out["user_message"] = user_message
    if agent_message:
        out["agent_message"] = agent_message
    out.update(extra)
    sys.stdout.write(json.dumps(out))
    sys.stdout.flush()


def deny(user_message: str, agent_message: str = "") -> None:
    emit("deny", user_message, agent_message or user_message)
    # Exit 2 also blocks if the host ignores JSON permission.
    sys.exit(2)


def ask(user_message: str, agent_message: str = "") -> None:
    emit("ask", user_message, agent_message or user_message)
    sys.exit(0)


def allow(**extra: Any) -> None:
    emit("allow", **extra)
    sys.exit(0)


def normalize_cmd(command: str) -> str:
    return " ".join(command.split())


def path_under_workspace(path: Path) -> bool:
    try:
        path.resolve().relative_to(WORKSPACE)
        return True
    except ValueError:
        return False


def rel_or_abs(path_str: str) -> Path:
    p = Path(path_str).expanduser()
    if not p.is_absolute():
        p = WORKSPACE / p
    return p


def is_protected_guardrail_path(path_str: str) -> bool:
    s = path_str.replace("\\", "/")
    # Strip workspace prefix for relative compare
    try:
        rel = str(rel_or_abs(path_str).resolve().relative_to(WORKSPACE)).replace("\\", "/")
    except Exception:
        rel = s.lstrip("./")
    for prefix in PROTECTED_WRITE_PREFIXES:
        if rel == prefix.rstrip("/") or rel.startswith(prefix) or s.endswith(prefix.rstrip("/")):
            return True
        if f"/{prefix}" in f"/{rel}" or prefix in s:
            return True
    return False


def is_rules_path(path_str: str) -> bool:
    s = path_str.replace("\\", "/")
    return ".cursor/rules/" in s or s.endswith(".cursor/rules")


def looks_like_secret_path(path_str: str) -> bool:
    s = path_str.replace("\\", "/")
    base = Path(s).name
    if base in SECRET_BASENAMES and "agent.env" not in s and "agent.env.example" not in s:
        # Allow reading committed examples
        if s.endswith(".example") or "/env.example" in s or "agent.env.example" in s:
            return False
        # Allow in-repo agent .env under workspace only via ask (handled elsewhere)
        if base == ".env" and "/opt/bizarre/" in s and "bizarre-prod" not in s:
            return False
        return True
    return any(snip in s for snip in SECRET_PATH_SNIPPETS if snip != "prod.env" or "prod.env" in s)


def extract_rm_targets(command: str) -> list[str]:
    """Best-effort parse of rm targets (not a full shell parser)."""
    # Strip rm and common flags
    m = re.search(r"\brm\b(?:\s+-[a-zA-Z]+)*\s+(.*)$", command)
    if not m:
        return []
    rest = m.group(1)
    # Stop at common shell operators
    rest = re.split(r"[;&|]", rest, maxsplit=1)[0]
    parts: list[str] = []
    token = ""
    in_q = None
    for ch in rest:
        if in_q:
            if ch == in_q:
                in_q = None
            token += ch
            continue
        if ch in "'\"":
            in_q = ch
            token += ch
            continue
        if ch.isspace():
            if token:
                parts.append(token.strip("'\""))
                token = ""
            continue
        token += ch
    if token:
        parts.append(token.strip("'\""))
    # Drop leftover flags
    return [p for p in parts if p and not p.startswith("-")]


def dangerous_rm(command: str) -> str | None:
    """Return deny reason or None."""
    if not re.search(r"\brm\b", command):
        return None
    if not re.search(r"\brm\b.*(-[a-zA-Z]*r|[a-zA-Z]*r[a-zA-Z]*)", command) and "rm -r" not in command:
        # non-recursive rm inside workspace is usually fine; still ask for broad globs later
        if re.search(r"\brm\s+(-f\s+)?(/|\$HOME|~|/home/)", command):
            return "rm targeting home or filesystem root"
        return None

    # Unexpanded variables in rm -r are a classic wipe vector
    if re.search(r"\brm\b.*\$\{?\w+\}?", command) and re.search(r"-[a-zA-Z]*r", command):
        return "recursive rm with shell variables (path may expand wrong)"

    targets = extract_rm_targets(command)
    if not targets:
        return "recursive rm with no clear target"

    for t in targets:
        if t in ("/", "*", "/*", "~", "$HOME", "${HOME}"):
            return f"recursive rm of dangerous target: {t}"
        if t.startswith("/home/") or t == "/root" or t.startswith("/root/"):
            return f"recursive rm of home path: {t}"
        try:
            p = rel_or_abs(t)
            # If path exists, resolve; else treat as relative to workspace
            resolved = p.resolve() if p.exists() else (WORKSPACE / t).resolve()
        except Exception:
            return f"recursive rm target could not be resolved: {t}"

        if str(resolved) in ("/", str(Path.home().resolve())):
            return f"recursive rm of {resolved}"
        if not path_under_workspace(resolved):
            return f"recursive rm outside workspace: {resolved}"
        # Inside workspace but deleting entire repo root
        if resolved == WORKSPACE:
            return "recursive rm of entire workspace root"
    return None


def shell_policy(command: str) -> tuple[str, str]:
    """Return (permission, message). permission in allow|ask|deny."""
    cmd = normalize_cmd(command)
    lower = cmd.lower()

    # --- hard deny ---
    if is_protected_guardrail_path(cmd) and re.search(
        r"\b(rm|mv|cp|tee|sed|perl|python|truncate|chmod|chown)\b", lower
    ):
        if ".cursor/hooks" in cmd.replace("\\", "/"):
            return "deny", "Refusing to modify Cursor hooks/guardrails from the agent shell."

    deny_res = [
        (r"\bmkfs\b", "mkfs is never allowed"),
        (r"\bdd\b.*\bof=/dev/", "dd writing to block devices is never allowed"),
        (r"\b:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;?", "fork bomb blocked"),
        (r"\bgit\s+push\b.*(--force|:force|-f)\b", "force-push blocked; use a PR"),
        (r"\bgit\s+push\s+-f\b", "force-push blocked; use a PR"),
        (r"\bgit\s+reset\s+--hard\b", "git reset --hard blocked"),
        (r"\bgit\s+clean\s+-[a-zA-Z]*f", "git clean -f blocked"),
        (r"\bgit\s+branch\s+-[dD]\s+(master|main)\b", "deleting master/main blocked"),
        (r"drop\s+(schema|database)\b", "DROP SCHEMA/DATABASE blocked"),
        (r"\bshred\b", "shred blocked"),
        (r"\bwipefs\b", "wipefs blocked"),
    ]
    for pat, msg in deny_res:
        if re.search(pat, lower):
            return "deny", msg

    for snip in PROD_PATH_SNIPPETS:
        if snip in cmd and re.search(r"\b(rm|mv|truncate|dd|chmod|chown|tee|pg_restore|drop)\b", lower):
            return "deny", f"destructive command touching prod path {snip}"

    for pat in SSH_DENY_PATTERNS:
        if re.search(pat, lower):
            return "deny", "SSH/PCT to Proxmox host or root is blocked for agents"

    rm_reason = dangerous_rm(cmd)
    if rm_reason:
        return "deny", rm_reason

    # Prefer git worktree remove over rm for worktrees
    if re.search(r"\brm\b.*worktree", lower) and "git worktree remove" not in lower:
        return "ask", "Prefer `git worktree remove` over rm for worktrees — confirm this path"

    # --- ask ---
    if re.search(r"\b(ssh|scp|sftp|rsync)\b", lower):
        if any(h in lower for h in SSH_ALLOW_HOSTS):
            return "ask", "SSH/SCP to bizarre-api agent host — approve only for triage"
        if re.search(r"\b(ssh|scp)\b", lower):
            return "ask", "Remote shell/copy — review destination carefully"

    ask_res = [
        (r"\brm\b.*-[a-zA-Z]*r", "recursive rm inside workspace — confirm targets"),
        (r"\bfind\b.*-delete\b", "find -delete — confirm scope"),
        (r"\btruncate\b", "truncate — confirm target"),
        (r"\b(drop|truncate)\s+table\b", "SQL DROP/TRUNCATE — confirm this is not prod"),
        (r"\bpg_restore\b", "pg_restore — confirm target database"),
        (r"\bcurl\b.*\|\s*(ba)?sh\b", "curl|sh pattern — review script before run"),
        (r"\bwget\b.*\|\s*(ba)?sh\b", "wget|sh pattern — review script before run"),
        (r"allow_prod_db\s*=\s*1", "ALLOW_PROD_DB=1 — agent should not hold prod write creds"),
        (r"\bsudo\b", "sudo — confirm narrow command"),
        (r"\bsystemctl\s+(restart|stop|disable|mask)\b", "service stop/restart — confirm intent"),
        (r"\bchmod\s+-R\b", "recursive chmod — confirm path"),
        (r"\bchown\s+-R\b", "recursive chown — confirm path"),
    ]
    for pat, msg in ask_res:
        if re.search(pat, lower):
            return "ask", msg

    return "allow", ""
