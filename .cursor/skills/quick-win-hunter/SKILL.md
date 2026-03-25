---
name: quick-win-hunter
description: Scans ~/.cursor/plans/ and the jojo-ttrpg-platform repo for work items completable in roughly under fifty lines or under thirty minutes (TODOs, small plan items, obvious gaps). Use when the user asks for quick wins, low-hanging fruit, small tasks, a fast backlog, or something shippable in one short session.
---

# Quick win hunter

## Goal

Produce a **prioritized list** of tasks that are likely **≤ ~50 lines changed** or **≤ ~30 minutes** for someone familiar with the repo. Favor **high certainty** over exhaustive coverage.

## Where to look

1. **`~/.cursor/plans/**/*.md`**
   - Checklists with unchecked `[ ]` items (especially under headings like *Quick*, *Nice to have*, *Later*, *Polish*, *Follow-up*).
   - Short bullets that imply a single file or one call site.
   - Explicit “small” or “trivial” notes; **skip** items that need design, migrations, or multi-service work unless clearly scoped to a tiny change.

2. **Repo root** `~/git/jojo-ttrpg-platform` (or current workspace if that path is the project)
   - `TODO`, `FIXME`, `HACK`, `XXX` (case-insensitive) in source and scripts; ignore `node_modules`, `venv`, `.git`, build artifacts, and large binary/sqlite backups unless the user cares.
   - **Linter-only** or **typing** fixes in one module.
   - **Copy/label** fixes, **single missing export**, **obvious typo** in API client vs backend field name (after a quick grep).
   - **Tests**: one missing assertion or a tiny fixture fix when pattern exists nearby.

## Exclusion heuristics (not quick wins)

- New features spanning frontend + backend + schema.
- Broad refactors, renames across packages, or “rewrite X”.
- Anything requiring product/architecture decisions or SRD/rulebook interpretation at length (defer unless the user narrows scope).

## How to run the scan

1. **Plans**: list/grep `~/.cursor/plans/` for checklist markers and keywords (`quick`, `small`, `polish`, `fix`, `typo`, `optional`).
2. **Code**: ripgrep from repo root for `TODO|FIXME|HACK|XXX` and skim recent diffs or touched files if the user gave a topic.
3. **De-duplicate**: merge overlapping plan bullets and code comments into one line item.
4. **Estimate**: tag each item **`~lines`** (S/M/L → S is under ~20 lines, M is ~20–50, L is out of scope) and **`~time`** (minutes). When unsure, say **uncertain** and widen the range.

## Output format

Use a short table or bullet list:

- **Item** — one sentence, actionable.
- **Where** — plan path and/or repo path (no Windows backslashes).
- **Why it is small** — one line.
- **Rough cost** — e.g. `~15 min, ~10 lines (S)` or `uncertain`.

Optional closing line: **Top 3 to do first** with one-line rationale each.

## Rules

- Respect project agent rules: do not read/write outside allowed paths; **do not delete plan files** without explicit user confirmation.
- This skill is **discovery and prioritization**; apply edits only if the user asks to implement.
