---
name: pr-doc-links
description: Draft SRD References for PR descriptions when mechanics change. Invoke via /pr-doc-links.
disable-model-invocation: true
---

# PR — doc links (mechanics)

## When to use

- A PR changes game mechanics (dice, rolls, P/E, XP, stress, assist, group actions, sessions, advancement).
- When the user types `/pr-doc-links`.

## Instructions

- Add a **References** line to the PR body citing `docs/1(800)-Bizarre SRD.md` (section or keywords).
- If behavior **diverges** from the SRD intentionally, one sentence explaining why.
- For UI/refactor/infra only, write “No mechanics change” or omit References.

## Output

A short References paragraph (or “No mechanics change”) ready to paste into the PR.
