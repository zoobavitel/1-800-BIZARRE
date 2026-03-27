---
name: campaign-management-session-card
description: Where CampaignManagement session UI sets defaults, dice history, manual rolls, and player dice pools; when to use sessionAPI.patchSession vs rollAPI. Use when editing frontend/src/pages/CampaignManagement.jsx session view.
---

# CampaignManagement session card

## When to use

- Editing `frontend/src/pages/CampaignManagement.jsx` session detail (defaults, dice history, manual rolls, player pool snapshot).

## Instructions

- **Session fields** (`default_position`, `default_effect`, `roll_goal_label`, `show_position_effect_to_players`, NPC involvements): **`sessionAPI.patchSession(session.id, …)`** then **`onRefresh()`** when provided.
- **Roll list / manual rolls / grant XP:** **`rollAPI.getRolls`**, **`rollAPI.createRoll`**, **`patchRoll`**, **`grantXP`** — not session PATCH.
- **Dice history** lives in the **Position & Effect** card behind a toggle; not a separate page section.
- **Player dice pools** section uses **last committed roll** per PC from `rolls` (snapshot, not live WebSocket).

## Reference

Search `handleUpdateSession`, `rollAPI`, `sessionAPI` in `CampaignManagement.jsx`.
