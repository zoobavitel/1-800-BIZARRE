---
name: git-commit-summarizer
description: Reads recent git history and produces structured release or patch notes from commits (themes, user-facing changes, risks). Use when the user asks for a changelog, release notes, patch notes, or a commit summary and wants interpreted prose beyond a raw git log.
---

# Git commit summarizer

## When to use

Apply when the user wants **human-readable** release or patch notes derived from commits—not a raw `git log` dump or tool-generated list without interpretation.

## Workflow

1. **Confirm scope**
   - Ask or infer: tag range (`v1.2.0..v1.3.0`), branch (`main` since last release), date window, or last *N* commits.
   - If unclear, default to comparing to the latest tag or last ~30 commits on the current branch.

2. **Collect history** (run in repo root; adjust ref range as needed)

   ```bash
   git log --no-merges --pretty=format:'%h %s' <range>
   ```

   For bodies (breaking changes, rationale):

   ```bash
   git log --no-merges --pretty=format:'---%n%h %s%n%b' <range>
   ```

3. **Synthesize** (do not copy commit messages verbatim as the only content)
   - **Themes**: 2–5 bullets grouping related work (e.g. auth, API, UI, performance).
   - **User-facing changes**: What players, GMs, or operators would notice; use plain language; include migration or setup steps if commits imply them.
   - **Risks / caveats**: Breaking changes, data or config migrations, security-sensitive edits, behavior changes, anything that needs testing or rollback awareness.
   - **Internal-only** (optional): Refactors, tests, tooling—only if the audience cares.

4. **Tone and accuracy**
   - Prefer present tense or "This release …" for notes; be factual—infer impact from diffs or messages when obvious, flag uncertainty ("likely …", "verify …") when not.
   - If commit messages are vague, say so briefly and describe what the code actually changed when you have context from the diff.

## Output template

Use this structure unless the user specifies another format:

```markdown
# [Release title or version]

## Summary
[One short paragraph: what this slice of history is about]

## Themes
- …

## User-facing changes
- …

## Risks and follow-ups
- …
```

For a **patch** or hotfix, keep the same sections but shorten Summary and Themes.

## What to avoid

- Listing every commit as its own bullet with no grouping.
- Marketing fluff without tying claims to commits.
- Omitting risks when commits touch auth, permissions, migrations, or default behavior.

## Optional: link to automation

If the user also wants machine-readable output, suggest they run their own changelog tool separately; this skill focuses on **interpreted** notes.
