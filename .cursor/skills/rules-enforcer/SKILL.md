---
name: rules-enforcer
description: Audits Markdown plan files in ~/.cursor/plans/ for YAML frontmatter with created and modified dates (YYYY-MM-DD), reports gaps and invalid values, and suggests exact fixes. Use when the user asks to audit plans, check plan frontmatter, or enforce plan file rules.
---

# Plan frontmatter audit

## Scope

Markdown files under `~/.cursor/plans/` (typically `*.md`). Required frontmatter (project rules): **`created`** and **`modified`**, each **`YYYY-MM-DD`**.

## Steps

1. **List targets** — glob or list `~/.cursor/plans/*.md` (and nested `**/*.md` if present).
2. **Parse** — opening `---` … closing `---` is YAML frontmatter; ignore fenced code that looks like `---` inside the body.
3. **Check each file**
   - Missing frontmatter → suggest adding:

     ```yaml
     ---
     created: YYYY-MM-DD
     modified: YYYY-MM-DD
     ---
     ```

   - Missing `created` or `modified` → name the key(s); suggest the block above with dates filled from context (use **today’s date** when unknown; say so if inferred).
   - Value not matching `^\d{4}-\d{2}-\d{2}$` → quote the bad value; suggest a corrected line.
   - Duplicate YAML keys for `created`/`modified` → treat as invalid; recommend **one** line per key (keep the intended date, drop duplicates).
4. **Output** — compact report: file path, issue, **suggested fix** (snippet or line replacement). Do not edit plans unless the user asked you to apply fixes.

## Notes

- Do not delete plan files without explicit user confirmation.
- This skill is audit-only unless the user requests applying changes.
