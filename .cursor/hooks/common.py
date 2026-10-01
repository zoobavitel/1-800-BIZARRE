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
    r"\bvzdump\b",
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
    # .env variants (.env.bak-*, .env.local, .env.prod.old, ...) and key material.
    # Only the in-repo agent `.env` itself is allowed further down.
    if base.startswith(".env") and base != ".env":
        return not base.endswith((".example", ".sample", ".template"))
    if base.endswith((".pem", ".key", ".p12", ".pfx")) or re.fullmatch(r"id_(rsa|ed25519|ecdsa|dsa)", base):
        return True
    if base in SECRET_BASENAMES and "agent.env" not in s and "agent.env.example" not in s:
        # Allow reading committed examples
        if s.endswith(".example") or "/env.example" in s or "agent.env.example" in s:
            return False
        # Allow in-repo agent .env under workspace only via ask (handled elsewhere)
        if base == ".env" and "/opt/bizarre/" in s and "bizarre-prod" not in s:
            return False
        return True
    return any(snip in s for snip in SECRET_PATH_SNIPPETS)


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
    # -r, -R, -rf, -Rf, -fr, --recursive (old check missed capital -R: `rm -Rf /` only got "ask")
    if not re.search(r"\brm\b.*\s(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)(\s|$)", command):
        # non-recursive rm inside workspace is usually fine; still ask for broad globs later
        if re.search(r"\brm\s+(-f\s+)?(/|\$HOME|~|/home/)", command):
            return "rm targeting home or filesystem root"
        return None

    # Unexpanded variables in rm -r are a classic wipe vector
    if re.search(r"\brm\b.*\$\{?\w+\}?", command):
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


# ---------------------------------------------------------------------------
# Write-target analysis
#
# Decides "does this command WRITE to a protected path?" instead of the old
# "does the command string MENTION a protected path?". Mentions in argument
# text (commit messages, PR bodies, grep patterns) are no longer a problem.
#
# Where a command's effect can't be known statically (inline interpreter code,
# piped stdin, xargs, eval, dynamic paths) it falls back to: deny if that opaque
# part mentions `.cursor` / `hooks.json`.
#
# This is a tripwire, not a wall. Any test runner, build tool or script can run
# arbitrary code. The wall is Unix permissions: the agent user must not own or
# be able to write .cursor/hooks*.
# ---------------------------------------------------------------------------

import glob as _glob
import shlex
import subprocess

GUARDRAIL_RELPATHS = (".cursor/hooks.json", ".cursor/hooks")
PROD_ROOTS = ("/opt/bizarre-prod", "/var/lib/bizarre", "/etc/bizarre")

_SUBST = "__HOOK_SUBST__"
_OPAQUE_MENTION = re.compile(r"\.cursor\b|hooks\.json")
_SEPARATORS = {";", "&&", "||", "|", "|&", "&", "(", ")", ";;", "$"}
_REDIR_OUT = {">", ">>", ">|", "&>", "&>>", "<>", ">&"}
_REDIR_IN = {"<", "<<", "<<-", "<<<"}
_KEYWORDS = {"if", "then", "else", "elif", "fi", "do", "done", "while", "until",
             "for", "in", "case", "esac", "{", "}", "!", "time", "coproc"}
_SHELLS = {"sh", "bash", "zsh", "dash", "ksh", "mksh", "busybox"}
_INLINE_FLAGS = {  # interpreter -> flags whose next arg is inline code
    "python": {"-c"}, "perl": {"-e", "-E"}, "ruby": {"-e"}, "node": {"-e", "-p", "--eval", "--print"},
    "php": {"-r"}, "awk": set(), "lua": {"-e"}, "deno": {"eval"},
}
_TRUSTED_PY_MODULES = {"unittest", "py_compile", "json.tool"}
_DESTROY_ON_ANCESTOR = {"rm", "rmdir", "mv", "chmod", "chown", "chgrp", "shred", "setfacl", "chattr"}
_ALL_ARGS_WRITERS = {"rm", "rmdir", "unlink", "shred", "truncate", "touch", "tee", "chattr", "setfacl", "mkdir"}
_MODE_FIRST = {"chmod", "chown", "chgrp"}
_COPY_LIKE = {"cp", "mv", "install", "ln", "rsync"}
_READONLY_EXEC = {"grep", "egrep", "rg", "cat", "head", "tail", "wc", "ls", "stat", "file", "echo",
                  "printf", "md5sum", "sha256sum", "du", "basename", "dirname", "realpath", "test", "["}
_GIT_PATH_CMDS = {"checkout", "restore", "rm", "mv", "clean", "stash", "reset", "apply", "checkout-index"}


def _preprocess(command: str) -> tuple[str, list[str], list[str]]:
    """Pull out $(...)/`...` substitutions and heredoc bodies; turn newlines into `;`.

    Returns (flattened command, substitution bodies, heredoc bodies).
    Substitutions are replaced by a placeholder so paths built from them are
    recognised as dynamic.
    """
    out: list[str] = []
    subs: list[str] = []
    heredocs: list[str] = []
    pending: list[tuple[str, bool]] = []  # (delimiter, strip_tabs)
    quote: str | None = None
    i, n = 0, len(command)
    while i < n:
        ch = command[i]
        if quote == "'":
            out.append(ch)
            if ch == "'":
                quote = None
            i += 1
            continue
        if ch == "\\" and i + 1 < n:
            out.append(command[i:i + 2])
            i += 2
            continue
        if ch == "'" and quote is None:
            quote = "'"
            out.append(ch)
            i += 1
            continue
        if ch == '"':
            quote = None if quote == '"' else '"'
            out.append(ch)
            i += 1
            continue
        if ch == "$" and command.startswith("$(", i):
            depth, j = 0, i + 1
            while j < n:
                if command[j] == "(":
                    depth += 1
                elif command[j] == ")":
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            subs.append(command[i + 2:j])
            out.append(_SUBST)
            i = j + 1
            continue
        if ch == "`":
            j = command.find("`", i + 1)
            j = n if j == -1 else j
            subs.append(command[i + 1:j])
            out.append(_SUBST)
            i = j + 1
            continue
        if quote is None and command.startswith("<<", i) and not command.startswith("<<<", i):
            m = re.match(r"<<(-?)\s*(['\"]?)([A-Za-z0-9_.-]+)\2", command[i:])
            if m:
                pending.append((m.group(3), m.group(1) == "-"))
                out.append(m.group(0))
                i += len(m.group(0))
                continue
        if ch == "\n" and quote is None:
            i += 1
            while pending:
                delim, strip = pending.pop(0)
                body: list[str] = []
                while i < n:
                    j = command.find("\n", i)
                    j = n if j == -1 else j
                    line = command[i:j]
                    i = j + 1
                    if (line.lstrip("\t") if strip else line) == delim:
                        break
                    body.append(line)
                heredocs.append("\n".join(body))
            out.append(" ; ")
            continue
        out.append(ch)
        i += 1
    return "".join(out), subs, heredocs


def _tokenize(command: str) -> list[str] | None:
    lex = shlex.shlex(command, posix=True, punctuation_chars=True)
    lex.whitespace_split = True
    lex.commenters = ""
    try:
        return list(lex)
    except ValueError:
        return None


def _split_segments(tokens: list[str]) -> list[tuple[list[str], bool]]:
    """Split on shell separators. Returns (tokens, fed_by_pipe)."""
    segs: list[tuple[list[str], bool]] = []
    cur: list[str] = []
    piped = False
    for t in tokens:
        if t in _SEPARATORS:
            if cur:
                segs.append((cur, piped))
            cur = []
            piped = t in ("|", "|&")
        else:
            cur.append(t)
    if cur:
        segs.append((cur, piped))
    return segs


def _strip_wrappers(tokens: list[str]) -> list[str]:
    """Drop VAR=val, sudo/env/nohup/timeout/... prefixes to reach the real command."""
    t = list(tokens)
    while t:
        head = os.path.basename(t[0])
        if t[0] in _KEYWORDS or re.match(r"^[A-Za-z_]\w*=", t[0]):
            t.pop(0)
        elif head in ("sudo", "doas"):
            t.pop(0)
            while t and t[0].startswith("-"):
                flag = t.pop(0)
                if flag in ("-u", "-g", "-h", "-p", "-C", "-U", "-r", "-t", "-D") and t:
                    t.pop(0)
        elif head == "env":
            t.pop(0)
            while t and (t[0].startswith("-") or "=" in t[0]):
                flag = t.pop(0)
                if flag in ("-u", "-C", "--chdir", "--unset") and t:
                    t.pop(0)
        elif head in ("nohup", "command", "builtin", "setsid", "chronic", "unbuffer"):
            t.pop(0)
        elif head in ("exec", "nice", "ionice", "stdbuf"):
            t.pop(0)
            while t and t[0].startswith("-"):
                flag = t.pop(0)
                if flag in ("-a", "-n", "-c") and t:
                    t.pop(0)
        elif head == "timeout":
            t.pop(0)
            while t and t[0].startswith("-"):
                flag = t.pop(0)
                if flag in ("-s", "-k", "--signal", "--kill-after") and t:
                    t.pop(0)
            if t:
                t.pop(0)  # duration
        else:
            break
    return t


def _split_redirects(tokens: list[str]) -> tuple[list[str], list[str], list[str], list[str]]:
    """Return (args, output redirect targets, input redirect files, here-strings)."""
    args: list[str] = []
    outs: list[str] = []
    ins: list[str] = []
    herestrings: list[str] = []
    i = 0
    while i < len(tokens):
        t = tokens[i]
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        if t in _REDIR_OUT or t in _REDIR_IN:
            # drop a bare fd number glued before the operator (2>file)
            if args and args[-1].isdigit():
                args.pop()
            if t in _REDIR_OUT and nxt is not None and not (t == ">&" and (nxt.isdigit() or nxt == "-")):
                outs.append(nxt)
            if t == "<<<" and nxt is not None:
                herestrings.append(nxt)
            if t == "<" and nxt is not None:
                ins.append(nxt)
            i += 2
            continue
        args.append(t)
        i += 1
    return args, outs, ins, herestrings


def _positional(args: list[str]) -> list[str]:
    out, end_flags = [], False
    for a in args:
        if not end_flags and a == "--":
            end_flags = True
            continue
        if not end_flags and a.startswith("-") and a != "-":
            continue
        out.append(a)
    return out


def _is_dynamic(path: str) -> bool:
    return _SUBST in path or any(c in path for c in "${}`")


def _resolve(path: str, cwd: Path) -> list[Path]:
    """Resolve a literal path (with globs expanded) to absolute real paths."""
    p = os.path.expanduser(path)
    full = p if os.path.isabs(p) else os.path.join(str(cwd), p)
    hits = [Path(os.path.realpath(full))]
    if any(c in p for c in "*?["):
        hits += [Path(os.path.realpath(m)) for m in _glob.glob(full)]
    return hits


def _protected_roots() -> list[Path]:
    return [Path(os.path.realpath(WORKSPACE / rel)) for rel in GUARDRAIL_RELPATHS]


def _under(child: Path, parent: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


class _Finding(Exception):
    def __init__(self, permission: str, message: str):
        super().__init__(message)
        self.permission = permission
        self.message = message


def _check_target(raw: str, cwd: Path | None, op: str, *, ancestor_counts: bool, full_cmd: str) -> None:
    if cwd is None or _is_dynamic(raw):
        if _OPAQUE_MENTION.search(raw) or (cwd is None and _OPAQUE_MENTION.search(full_cmd)):
            raise _Finding("deny", f"`{op}` writes to a dynamic path near .cursor guardrails")
        return
    for target in _resolve(raw, cwd):
        for root in _protected_roots():
            if _under(target, root):
                raise _Finding("deny", f"`{op}` would modify protected guardrail path {root.relative_to(WORKSPACE)}")
            if ancestor_counts and _under(root, target):
                raise _Finding("deny", f"`{op}` on {raw} would also affect {root.relative_to(WORKSPACE)}")
        for prod in PROD_ROOTS:
            prod_p = Path(prod)
            if _under(target, prod_p) or (ancestor_counts and _under(prod_p, target)):
                raise _Finding("deny", f"`{op}` would modify prod path {prod}")


def _git(args: list[str], cwd: Path) -> subprocess.CompletedProcess | None:
    try:
        return subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True, timeout=5)
    except Exception:
        return None


def _guardrails_dirty(cwd: Path) -> bool | None:
    r = _git(["status", "--porcelain", "--", *GUARDRAIL_RELPATHS], WORKSPACE)
    if r is None or r.returncode != 0:
        return None
    return bool(r.stdout.strip())


def _ref_changes_guardrails(ref: str, cwd: Path) -> bool | None:
    """True if checking out `ref` would change the guardrail files; None if `ref` isn't a ref."""
    v = _git(["rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}"], cwd)
    if v is None or v.returncode != 0:
        return None
    d = _git(["diff", "--quiet", "HEAD", ref, "--", *GUARDRAIL_RELPATHS], WORKSPACE)
    if d is None:
        return True
    return d.returncode != 0


def _check_git(args: list[str], cwd: Path | None, full_cmd: str) -> Path | None:
    """Handle git; returns possibly-updated cwd (git -C is per-command, so it doesn't persist)."""
    a = args[1:]
    gcwd = cwd
    while a and a[0].startswith("-"):
        flag = a.pop(0)
        if flag == "-C" and a:
            d = a.pop(0)
            gcwd = None if (gcwd is None or _is_dynamic(d)) else Path(os.path.realpath(gcwd / os.path.expanduser(d)))
        elif flag in ("-c", "--git-dir", "--work-tree", "--namespace") and a:
            a.pop(0)
    if not a:
        return cwd
    sub, rest = a[0], a[1:]
    paths = _positional(rest)
    if sub in _GIT_PATH_CMDS:
        for p in paths:
            if p.startswith(":") or p in ("stash", "push", "pop", "apply", "drop", "save", "list", "show", "clear"):
                continue
            _check_target(p, gcwd, f"git {sub}", ancestor_counts=True, full_cmd=full_cmd)
    if gcwd is None:
        return cwd
    # Branch switches can silently swap the guardrails for an older (or missing) version.
    if sub in ("merge", "rebase", "cherry-pick", "revert") and paths:
        if _ref_changes_guardrails(paths[0], gcwd):
            raise _Finding("ask", f"`git {sub} {paths[0]}` touches a branch with different .cursor guardrails — confirm")
    if sub in ("checkout", "switch") and paths and "--" not in rest:
        changes = _ref_changes_guardrails(paths[0], gcwd)
        if changes:
            raise _Finding("ask", f"`git {sub} {paths[0]}` changes .cursor guardrail files — confirm")
    # Broad worktree-discarding forms: only matter if guardrails have uncommitted edits.
    broad = (
        (sub == "stash" and (not rest or rest[0] in ("push", "save", "-u", "--include-untracked", "-a", "--all")))
        or (sub in ("checkout", "switch") and any(f in rest for f in ("-f", "--force", "--discard-changes")))
        or (sub in ("checkout", "restore") and "." in paths)
    )
    if broad:
        dirty = _guardrails_dirty(gcwd)
        if dirty:
            raise _Finding("deny", f"`git {sub}` would discard uncommitted edits to .cursor guardrails")
        if dirty is None:
            raise _Finding("ask", f"could not verify guardrail state before `git {sub}` — confirm")
    if sub == "stash" and rest and rest[0] in ("pop", "apply"):
        ref = _positional(rest[1:])[:1] or ["stash@{0}"]
        r = _git(["stash", "show", "--name-only", "--include-untracked", ref[0]], gcwd)
        if r is not None and any(ln.startswith(".cursor/hooks") for ln in r.stdout.splitlines()):
            raise _Finding("deny", "stash would overwrite .cursor guardrail files")
    return cwd


def _interp_name(name: str) -> str | None:
    if re.fullmatch(r"python[\d.]*|pypy[\d.]*", name):
        return "python"
    if re.fullmatch(r"g?awk|mawk", name):
        return "awk"
    if name in _INLINE_FLAGS:
        return name
    return None


def _script_is_trusted(path: str, cwd: Path | None) -> bool:
    if cwd is None or _is_dynamic(path):
        return False
    target = Path(os.path.realpath(os.path.join(str(cwd), os.path.expanduser(path))))
    return any(_under(target, root) for root in _protected_roots())


def _read_script(path: str, cwd: Path | None) -> str | None:
    if cwd is None or _is_dynamic(path):
        return None
    try:
        p = Path(os.path.realpath(os.path.join(str(cwd), os.path.expanduser(path))))
        if p.is_file() and p.stat().st_size <= 512_000:
            return p.read_text(errors="replace")
    except OSError:
        pass
    return None


def _is_guardrail_ancestor(raw: str, cwd: Path | None) -> bool:
    if cwd is None or _is_dynamic(raw):
        return False
    return any(_under(root, t) for t in _resolve(raw, cwd) for root in _protected_roots())


def _patch_touches_guardrails(raw: str, cwd: Path | None) -> bool:
    body = _read_script(raw, cwd)
    return body is None and _OPAQUE_MENTION.search(raw) is not None or bool(
        body and re.search(r"^(\+\+\+|---|diff --git) .*\.cursor/hooks", body, re.M))


def _check_segment(tokens: list[str], piped: bool, cwd: Path | None, full_cmd: str,
                   heredocs: list[str], depth: int) -> Path | None:
    """Raise _Finding on a problem. Returns cwd for the next segment (tracks literal `cd`)."""
    args, outs, ins, herestrings = _split_redirects(tokens)
    for t in outs:
        _check_target(t, cwd, "redirect", ancestor_counts=False, full_cmd=full_cmd)
    args = _strip_wrappers(args)
    if not args:
        return cwd
    name = os.path.basename(args[0])
    pos = _positional(args[1:])

    if name in ("cd", "pushd"):
        if not pos:
            return Path.home()
        if cwd is None or _is_dynamic(pos[0]) or pos[0] == "-":
            return None
        return Path(os.path.realpath(cwd / os.path.expanduser(pos[0])))

    if name in ("xargs", "parallel", "eval"):
        if name == "eval":
            _check_command(" ".join(args[1:]), cwd, depth + 1)
        elif _OPAQUE_MENTION.search(full_cmd):
            raise _Finding("deny", f"`{name}` with paths near .cursor guardrails can't be verified")
        return cwd

    if name in _SHELLS or name in ("source", "."):
        rest = args[1:]
        if name == "busybox" and rest and rest[0] in ("sh", "ash"):
            rest = rest[1:]
        if "-c" in rest:
            idx = rest.index("-c")
            if idx + 1 < len(rest):
                _check_command(rest[idx + 1], cwd, depth + 1)
            return cwd
        script = _positional(rest)
        if script and script[0] != "-":
            if not _script_is_trusted(script[0], cwd):
                body = _read_script(script[0], cwd)
                if body is not None:
                    _check_command(body, cwd, depth + 1)
                elif _OPAQUE_MENTION.search(full_cmd):
                    raise _Finding("deny", "shell script near .cursor guardrails can't be inspected")
            return cwd
        for body in heredocs + herestrings:
            _check_command(body, cwd, depth + 1)
        if piped and _OPAQUE_MENTION.search(full_cmd):
            raise _Finding("deny", "shell reading piped input near .cursor guardrails")
        return cwd

    interp = _interp_name(name)
    if interp:
        rest = args[1:]
        inline: list[str] = []
        flags = _INLINE_FLAGS.get(interp, set())
        i = 0
        while i < len(rest):
            if rest[i] in flags and i + 1 < len(rest):
                inline.append(rest[i + 1])
                i += 2
                continue
            if interp == "python" and rest[i] == "-m" and i + 1 < len(rest):
                if rest[i + 1].split(".")[0] not in {m.split(".")[0] for m in _TRUSTED_PY_MODULES}:
                    inline.append(" ".join(rest[i + 1:]))
                break
            i += 1
        if interp == "awk":
            p = _positional(rest)
            if p:
                inline.append(p[0])
            if "-i" in rest and "inplace" in rest:
                for f in p[1:]:
                    _check_target(f, cwd, "awk -i inplace", ancestor_counts=False, full_cmd=full_cmd)
        if interp == "perl" and any(re.fullmatch(r"-\w*i\S*", a) for a in rest):
            for f in _positional([a for a in rest if a not in inline]):
                _check_target(f, cwd, "perl -i", ancestor_counts=False, full_cmd=full_cmd)
        for code in inline + herestrings:
            if _OPAQUE_MENTION.search(code):
                raise _Finding("deny", f"inline {interp} code touching .cursor guardrails")
        if not inline and interp != "awk":
            script = _positional(rest)
            if not script or script[0] == "-":
                if any(_OPAQUE_MENTION.search(h) for h in heredocs) or (piped and _OPAQUE_MENTION.search(full_cmd)):
                    raise _Finding("deny", f"{interp} reading stdin near .cursor guardrails")
            elif not _script_is_trusted(script[0], cwd):
                body = _read_script(script[0], cwd)
                if body is not None and _OPAQUE_MENTION.search(body):
                    raise _Finding("deny", f"{script[0]} references .cursor guardrails")
        return cwd

    if name == "patch" or (name == "git" and len(args) > 1 and args[1] in ("apply", "am")):
        files = ins + (pos[1:] if name == "git" else [a for a in pos if a.endswith((".diff", ".patch"))])
        for f in files:
            if _patch_touches_guardrails(f, cwd):
                raise _Finding("deny", f"patch {f} modifies .cursor guardrails")
        if not files and _OPAQUE_MENTION.search(full_cmd):
            raise _Finding("deny", "patch from stdin near .cursor guardrails")
        if name == "patch":
            return cwd

    if name in ("tar", "unzip", "bsdtar", "7z"):
        extracting = name in ("unzip",) or (name == "7z" and "x" in pos[:1]) or (
            len(args) > 1 and re.match(r"^-?[a-zA-Z]*x", args[1])) or "--extract" in args or "-x" in args
        if extracting:
            dest = "."
            for k, a in enumerate(args):
                if a in ("-C", "--directory", "-d") and k + 1 < len(args):
                    dest = args[k + 1]
                elif a.startswith("--directory="):
                    dest = a.split("=", 1)[1]
            _check_target(dest, cwd, name, ancestor_counts=False, full_cmd=full_cmd)
            if _is_guardrail_ancestor(dest, cwd):
                raise _Finding("ask", f"{name} extracting over a tree containing .cursor guardrails — confirm archive contents")
        return cwd

    if name == "git":
        return _check_git(args, cwd, full_cmd)

    if name == "dd":
        for a in args[1:]:
            if a.startswith("of="):
                _check_target(a[3:], cwd, "dd", ancestor_counts=False, full_cmd=full_cmd)
        return cwd

    if name == "sed" and any(a == "--in-place" or a.startswith("--in-place=")
                             or re.fullmatch(r"-[a-zA-Z]*i\S*", a) for a in args[1:]):
        for f in pos:
            _check_target(f, cwd, "sed -i", ancestor_counts=False, full_cmd=full_cmd)
        return cwd

    if name == "find":
        actions = {"-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprintf", "-fls"}
        rest = args[1:]
        if not actions.intersection(rest):
            return cwd
        readonly = True
        if "-delete" in rest or any(a in ("-fprint", "-fprintf", "-fls") for a in rest):
            readonly = False
        for k, a in enumerate(rest):
            if a in ("-exec", "-execdir", "-ok", "-okdir") and k + 1 < len(rest):
                if os.path.basename(rest[k + 1]) not in _READONLY_EXEC:
                    readonly = False
        if readonly:
            return cwd
        roots = []
        for a in rest:
            if a.startswith("-") or a in ("(", "!", ")"):
                break
            roots.append(a)
        roots = roots or ["."]
        if _OPAQUE_MENTION.search(" ".join(rest[len(roots):])):
            raise _Finding("deny", "find action targeting .cursor guardrails")
        for r in roots:
            try:
                _check_target(r, cwd, "find", ancestor_counts=False, full_cmd=full_cmd)
            except _Finding as f:
                raise f
            if cwd is not None and not _is_dynamic(r):
                for target in _resolve(r, cwd):
                    if _under(target, Path(os.path.realpath(WORKSPACE / ".cursor"))):
                        raise _Finding("deny", "find with a destructive action inside .cursor")
                    if any(_under(root, target) for root in _protected_roots()):
                        raise _Finding("ask", "find with a destructive action over a tree containing "
                                              ".cursor guardrails — add `-not -path './.cursor/*'` or confirm")
        return cwd

    if name in _ALL_ARGS_WRITERS or name in _MODE_FIRST:
        targets = pos
        if name in _MODE_FIRST and not any(a.startswith("--reference") for a in args):
            targets = pos[1:]
        for t in targets:
            _check_target(t, cwd, name, ancestor_counts=name in _DESTROY_ON_ANCESTOR, full_cmd=full_cmd)
        return cwd

    if name in _COPY_LIKE:
        rest = args[1:]
        dest = None
        for k, a in enumerate(rest):
            if a in ("-t", "--target-directory") and k + 1 < len(rest):
                dest = rest[k + 1]
            elif a.startswith("--target-directory="):
                dest = a.split("=", 1)[1]
        p = [x for x in pos if x != dest]
        if dest is None and p:
            dest = p.pop()
        if dest is None:
            return cwd
        if name in ("cp", "rsync") and any(re.fullmatch(r"-[a-zA-Z]*[raR][a-zA-Z]*", a) or a in ("--recursive", "--archive") for a in rest):
            if _is_guardrail_ancestor(dest, cwd):
                raise _Finding("ask", f"recursive {name} into a tree containing .cursor guardrails — confirm source has no .cursor/")
        if name == "mv":
            for src in p:
                _check_target(src, cwd, "mv", ancestor_counts=True, full_cmd=full_cmd)
        _check_target(dest, cwd, name, ancestor_counts=(name == "rsync"), full_cmd=full_cmd)
        if cwd is not None and not _is_dynamic(dest):
            dest_abs = _resolve(dest, cwd)[0]
            if dest_abs.is_dir() or dest.endswith("/"):
                for src in p:
                    _check_target(os.path.join(dest, os.path.basename(src.rstrip("/"))), cwd, name,
                                  ancestor_counts=False, full_cmd=full_cmd)
        return cwd

    return cwd


def _check_command(command: str, cwd: Path | None, depth: int = 0) -> None:
    if depth > 4:
        if _OPAQUE_MENTION.search(command):
            raise _Finding("deny", "deeply nested command near .cursor guardrails")
        return
    flat, subs, heredocs = _preprocess(command)
    for s in subs:
        _check_command(s, cwd, depth + 1)
    tokens = _tokenize(flat)
    if tokens is None:
        if _OPAQUE_MENTION.search(command):
            raise _Finding("deny", "unparseable command near .cursor guardrails")
        return
    for seg, piped in _split_segments(tokens):
        cwd = _check_segment(seg, piped, cwd, command, heredocs, depth)


def guardrail_check(command: str, cwd: str | os.PathLike | None = None) -> tuple[str, str] | None:
    """Return (permission, message) if the command writes to guardrail or prod paths, else None."""
    start = Path(os.path.realpath(cwd)) if cwd else WORKSPACE
    try:
        _check_command(command, start)
    except _Finding as f:
        return f.permission, f.message
    return None


def shell_policy(command: str, cwd: str | os.PathLike | None = None) -> tuple[str, str]:
    """Return (permission, message). permission in allow|ask|deny."""
    guard = guardrail_check(command, cwd)
    if guard and guard[0] == "deny":
        return guard

    cmd = normalize_cmd(command)
    lower = cmd.lower()

    # --- hard deny ---
    deny_res = [
        (r"\bmkfs\b", "mkfs is never allowed"),
        (r"\bdd\b.*\bof=/dev/", "dd writing to block devices is never allowed"),
        (r"\b:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;?", "fork bomb blocked"),
        (r"\bgit\s+push\b.*(--force|:force|-f)\b", "force-push blocked; use a PR"),
        (r"\bgit\s+push\s+-f\b", "force-push blocked; use a PR"),
        (r"\bgit\s+push\b.*\s\+\S", "force-push via +refspec blocked; use a PR"),
        (r"\bgit\s+push\b.*(--delete|\s-d)\b.*\b(master|main)\b", "deleting remote master/main blocked"),
        (r"\bgit\s+push\b.*\s:(master|main)\b", "deleting remote master/main blocked"),
        (r"\bgit\s+reset\s+--hard\b", "git reset --hard blocked"),
        (r"\bgit\s+clean\s+-[a-zA-Z]*f", "git clean -f blocked"),
        (r"\bgit\s+branch\s+-[dD]\s+(master|main)\b", "deleting master/main blocked"),
        (r"drop\s+(schema|database)\b", "DROP SCHEMA/DATABASE blocked"),
        (r"\bdropdb\b", "dropdb blocked"),
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
    if guard and guard[0] == "ask":
        return guard

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
