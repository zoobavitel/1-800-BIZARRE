#!/usr/bin/env python3
"""Tests for the Cursor shell hook policy.

Run (from repo root):  python3 -m unittest discover -s .cursor/hooks/tests -v

Builds a throwaway git workspace so path resolution and git checks are real.
"""

from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parents[1]

_tmp = tempfile.TemporaryDirectory()
WS = Path(os.path.realpath(_tmp.name))
os.environ["CURSOR_PROJECT_DIR"] = str(WS)

spec = importlib.util.spec_from_file_location("hook_common", HOOKS_DIR / "common.py")
common = importlib.util.module_from_spec(spec)
sys.modules["hook_common"] = common
spec.loader.exec_module(common)


def _git(*args: str) -> None:
    subprocess.run(["git", *args], cwd=WS, check=True, capture_output=True)


def setUpModule() -> None:
    (WS / ".cursor/hooks/tests").mkdir(parents=True)
    (WS / ".cursor/rules").mkdir(parents=True)
    (WS / ".cursor/hooks.json").write_text("{}\n")
    (WS / ".cursor/hooks/common.py").write_text("# hook\n")
    (WS / "backend/src").mkdir(parents=True)
    (WS / "backend/src/app.py").write_text("print('hi')\n")
    (WS / "scripts").mkdir()
    (WS / "scripts/evil.sh").write_text("echo cleaning\nrm -rf .cursor/hooks\n")
    (WS / "scripts/evil.py").write_text("import shutil\nshutil.rmtree('.cursor/hooks')\n")
    (WS / "scripts/fine.py").write_text("print('ok')\n")
    _git("init", "-q", "-b", "feature")
    _git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A")
    _git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init")
    _git("branch", "same-guardrails")
    _git("checkout", "-q", "-b", "old-guardrails")
    (WS / ".cursor/hooks.json").write_text('{"old": true}\n')
    _git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qam", "older hooks")
    _git("checkout", "-q", "feature")


def tearDownModule() -> None:
    _tmp.cleanup()


def perm(cmd: str, cwd: Path | None = None) -> str:
    return common.shell_policy(cmd, cwd)[0]


class FalsePositivesFixed(unittest.TestCase):
    """Commands that merely mention the hooks path must not be blocked."""

    def test_mentions_are_fine(self):
        for cmd in [
            'gh pr create --title "guardrails" --body "run python3 .cursor/hooks/tests then rm -i nothing"',
            'git commit -m "fix python matching in .cursor/hooks/common.py"',
            "grep -rn 'python' .cursor/hooks/",
            "cat .cursor/hooks.json",
            "python3 -m json.tool .cursor/hooks.json",
            "python3 -m unittest discover -s .cursor/hooks/tests -v",
            "python3 .cursor/hooks/tests/test_shell_policy.py",
            "git diff .cursor/hooks/",
            "git add .cursor/rules/x.mdc && git status",
            "cp .cursor/hooks.json /tmp/review.json",
            "ls -la .cursor && echo done 2>/dev/null",
            "find . -name '*.py' -exec grep -l shell_policy {} +",
            "python3 scripts/fine.py",
            "git checkout same-guardrails",
        ]:
            with self.subTest(cmd=cmd):
                self.assertEqual(perm(cmd), "allow")


class GuardrailWritesDenied(unittest.TestCase):
    def test_direct_writes(self):
        for cmd in [
            "rm .cursor/hooks.json",
            "rm -rf .cursor",
            "rm -rf ./.cursor/hooks/",
            "mv .cursor/hooks.json /tmp/x",
            "mv .cursor .cursor.off",
            "cp /tmp/empty.json .cursor/hooks.json",
            "cp /tmp/hooks.json .cursor/",
            "echo '{}' > .cursor/hooks.json",
            "echo x >> .cursor/hooks/common.py",
            "printf '' | tee .cursor/hooks.json",
            "sed -i 's/deny/allow/' .cursor/hooks/common.py",
            "sed -i.bak -e 's/a/b/' .cursor/hooks/common.py",
            "perl -pi -e 's/deny/allow/' .cursor/hooks/common.py",
            "truncate -s 0 .cursor/hooks.json",
            "chmod 000 .cursor/hooks",
            "chmod -R u+w .cursor",
            "ln -sf /dev/null .cursor/hooks.json",
            "touch .cursor/hooks/zzz.py",
            "dd if=/dev/zero of=.cursor/hooks.json bs=1 count=1",
            "rm .cursor/hooks/*.py",
            "rm -rf .cur*",
            "cd .cursor/hooks && rm common.py",
            "cd .cursor && rm -r hooks",
            "git -C .cursor rm -r hooks",
            f"rm {WS}/.cursor/hooks.json",
        ]:
            with self.subTest(cmd=cmd):
                self.assertEqual(perm(cmd), "deny")

    def test_wrappers_and_nesting(self):
        for cmd in [
            "sudo rm .cursor/hooks.json",
            "env FOO=1 nohup rm .cursor/hooks.json",
            "timeout 5 mv .cursor/hooks.json x",
            "FOO=bar tee .cursor/hooks.json < /dev/null",
            "bash -c 'rm -rf .cursor/hooks'",
            "sh -c \"echo x > .cursor/hooks.json\"",
            "echo $(rm .cursor/hooks.json)",
            "echo `rm .cursor/hooks.json`",
            "eval 'rm .cursor/hooks.json'",
            "true\nrm .cursor/hooks.json",
            "if true; then rm .cursor/hooks.json; fi",
        ]:
            with self.subTest(cmd=cmd):
                self.assertEqual(perm(cmd), "deny")

    def test_opaque_code(self):
        for cmd in [
            "python3 -c \"open('.cursor/hooks.json','w')\"",
            "python3 -c \"import os; os.remove(os.path.join('.cursor','hooks.json'))\"",
            "node -e \"require('fs').unlinkSync('.cursor/hooks.json')\"",
            "python3 - <<'EOF'\nimport shutil\nshutil.rmtree('.cursor/hooks')\nEOF",
            "bash <<EOF\nrm -rf .cursor/hooks\nEOF",
            "echo .cursor/hooks.json | xargs rm",
            "echo 'rm .cursor/hooks.json' | bash",
            "bash scripts/evil.sh",
            "python3 scripts/evil.py",
            "cd \"$TMPDIR\" && rm -rf .cursor",
            "rm \"$HOOKS\"/../.cursor/hooks.json",
        ]:
            with self.subTest(cmd=cmd):
                self.assertEqual(perm(cmd), "deny")


class GitGuardrails(unittest.TestCase):
    def test_pathspecs(self):
        for cmd in [
            "git checkout -- .cursor/hooks.json",
            "git restore .cursor/hooks/common.py",
            "git rm -r --cached .cursor",
            "git checkout -- .",
        ]:
            with self.subTest(cmd=cmd):
                self.assertEqual(perm(cmd), "deny")

    def test_branch_switch_that_changes_hooks_asks(self):
        self.assertEqual(perm("git checkout old-guardrails"), "ask")
        self.assertEqual(perm("git switch old-guardrails"), "ask")
        self.assertEqual(perm("git merge old-guardrails"), "ask")
        self.assertEqual(perm("git rebase old-guardrails"), "ask")
        self.assertEqual(perm("git merge same-guardrails"), "allow")

    def test_patches(self):
        (WS / "evil.patch").write_text("diff --git a/.cursor/hooks.json b/.cursor/hooks.json\n--- a/.cursor/hooks.json\n+++ b/.cursor/hooks.json\n")
        (WS / "fine.patch").write_text("diff --git a/backend/src/app.py b/backend/src/app.py\n")
        try:
            self.assertEqual(perm("git apply evil.patch"), "deny")
            self.assertEqual(perm("patch -p1 < evil.patch"), "deny")
            self.assertEqual(perm("git apply fine.patch"), "allow")
        finally:
            (WS / "evil.patch").unlink()
            (WS / "fine.patch").unlink()

    def test_bulk_copies_and_archives_into_workspace_root_ask(self):
        self.assertEqual(perm("cp -a /tmp/somewhere/. ."), "ask")
        self.assertEqual(perm("rsync -a /tmp/somewhere/ ./"), "ask")
        self.assertEqual(perm("tar xzf bundle.tgz"), "ask")
        self.assertEqual(perm("tar xzf bundle.tgz -C backend"), "allow")
        self.assertEqual(perm("cp -r /tmp/somewhere backend/"), "allow")

    def test_broad_discard_only_blocked_when_hooks_dirty(self):
        self.assertEqual(perm("git stash"), "allow")
        (WS / ".cursor/hooks/common.py").write_text("# human edit in progress\n")
        try:
            self.assertEqual(perm("git stash"), "deny")
            self.assertEqual(perm("git checkout -f same-guardrails"), "deny")
        finally:
            _git("checkout", "--", ".cursor/hooks/common.py")


class ExistingPolicyGaps(unittest.TestCase):
    def test_now_denied(self):
        for cmd in [
            "rm -Rf /",
            "rm --recursive --force /",
            "rm -R ~",
            "dropdb bizarre_prod",
            "git push origin +master",
            "git push origin --delete master",
            "git push origin :main",
            "echo hi > /opt/bizarre-prod/backend/settings.py",
            "cp evil.env /etc/bizarre/prod.env",
            "mv /var/lib/bizarre/media /tmp/m",
        ]:
            with self.subTest(cmd=cmd):
                self.assertEqual(perm(cmd), "deny")

    def test_find_delete_over_workspace_asks(self):
        self.assertEqual(perm("find . -name '*.pyc' -delete"), "ask")
        self.assertEqual(perm("find backend -name '*.pyc' -delete"), "ask")  # existing find -delete ask rule
        self.assertEqual(perm("find .cursor -type f -delete"), "deny")

    def test_secret_paths(self):
        f = common.looks_like_secret_path
        self.assertTrue(f("/opt/bizarre/backend/src/.env.bak-pre-agent-split"))
        self.assertTrue(f("/opt/bizarre/backend/src/.env.local"))
        self.assertTrue(f("/etc/bizarre/prod.env"))
        self.assertTrue(f("/home/agent/.ssh/id_ed25519"))
        self.assertTrue(f("certs/server.key"))
        self.assertFalse(f("/opt/bizarre/backend/src/.env.example"))
        self.assertFalse(f("/opt/bizarre/backend/src/.env"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
