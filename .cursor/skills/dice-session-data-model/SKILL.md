---
name: dice-session-data-model
description: Maps Roll.session vs Campaign.active_session, XP storage (ExperienceTracker vs XPHistory), and GM-only roll endpoints. Use when changing rolls, sessions, campaigns, XP APIs, or explaining why rolls stay on a past session.
---

# Dice & session data model (jojo-ttrpg-platform)

## When to use

- Implementing or debugging rolls, sessions, campaign active session, XP APIs, or GM-only roll creation.
- Explaining whether rolls “move” when the active session changes (they do not).

## Instructions

- **`Roll.session_id`** is permanent for that roll until the **`Session`** row is deleted.
- **`Campaign.active_session`** only picks the current session; it does **not** migrate rolls.
- **`Roll.session` CASCADE:** deleting a `Session` deletes its rolls — avoid hard-deleting played sessions if history matters.
- **XP:** `ExperienceTracker` (granular gains) vs `XPHistory` (ledger); APIs `/experience-tracker/` and `/xp-history/` with `?character=`.
- **GM-only:** `POST /rolls/` (manual), PATCH roll, grant-xp.
- **Listing rolls:** `GET /rolls/?session=<id>` works for **past** sessions when browsing that session.

## Reference

Roll model and `RollViewSet` in `backend/src/characters/`.
