---
name: character-sheet-change-checklist
description: Verifies session roll fetching, active_session_detail usage, position/effect GM visibility, and roll-modal API payloads when editing frontend/src/pages/CharacterSheet.jsx. Use when changing CharacterSheet, session rolls, roll modal, position/effect display, or characterAPI.rollAction wiring.
---

# CharacterSheet change checklist

## When to use

- Editing `CharacterSheet.jsx`, session rolls, roll modal, position/effect display, or `characterAPI.rollAction` wiring.

## Instructions

`frontend/src/pages/CharacterSheet.jsx` is large; refactors often leave **half-wired state** (stale fetches, missing `active_session_detail` fields, P/E hidden in one place but shown in another, or a payload field dropped from `rollAction`). After any substantive edit, walk this list.

## Quick checklist

Copy and tick mentally or in the PR:

```
- [ ] Session rolls: fetch deps + refresh after server roll
- [ ] active_session_detail: same fields wherever session UI reads them
- [ ] P/E visibility: GM flag honored everywhere P/E is shown
- [ ] Roll modal: full payload to characterAPI.rollAction + result handling
```

---

## 1. Session rolls fetch

**State:** `sessionRolls` / `setSessionRolls`.

**Initial load** — `useEffect` keyed on `activeSessionId` and `characterId`:

- Calls `rollAPI.getRolls({ session: activeSessionId, character: characterId })`.
- When session or character is missing, clears to `[]`.

**After a successful session roll** — `handleRollWithSession`:

- Refetches with the same `getRolls` call so UI (e.g. desperate action count, history) stays in sync.

**Derived UI** — `desperateActionRollCount` `useMemo` depends on `sessionRolls`; dice history panel may gate P/E columns with `showPositionEffect`.

**If you change:** how `activeSessionId` is resolved, character switching, or roll persistence — re-check all three (effect deps, refetch path, memos).

---

## 2. `active_session_detail`

Campaign data comes from `charCampaign` (parent `campaigns` prop). Session-scoped fields live on **`charCampaign?.active_session_detail`** (sometimes aliased `asd` in handlers).

Common fields used in this file:

- `default_position`, `default_effect`
- `show_position_effect_to_players` (visibility; see below)
- `roll_goal_label`
- `session_npcs_with_clocks` (and related UI)

**If you add or rename backend fields:** update every read site (inline action area, roll modal, `handleRollWithSession` / `setDiceResult` fallbacks) so position/effect/goal labels do not disagree between API response and GM defaults.

---

## 3. Position / effect (P/E) visibility

**GM flag:** `charCampaign?.active_session_detail?.show_position_effect_to_players`

Convention in this file: **`!== false`** means show P/E (default visible).

Verify **both**:

- Main sheet / action pool UI that shows `PositionStack` / `EffectShapes` or position labels.
- Fixed **roll modal** (`rollPending`) — either shows read-only P/E or the “hidden — ask your GM” copy.

Do not show full P/E in one block while the other still assumes visibility (or vice versa) unless intentional.

---

## 4. Roll modal payload (`handleRollWithSession` → `characterAPI.rollAction`)

Confirm the object passed to `characterAPI.rollAction(characterId, { ... })` stays aligned with the modal UI and backend:

- `session_id`: `activeSessionId`
- `push_effect`, `push_dice`, `devil_bargain_dice`, `devil_bargain_note`
- `bonus_dice`, `ability_effect_steps`, `ability_bonuses` (from ability checkboxes / audit)
- `goal_label` from `active_session_detail.roll_goal_label` (trimmed; optional)
- `group_action_id` when a group action is active

After response, confirm **`setDiceResult`** still maps `position` / `effect` / XP / stress using **`res` vs `asd` fallbacks** where appropriate, and that session rolls are refetched (see §1).

**Opening the modal:** `rollDice` with session context sets `rollPending` and initializes `rollModal` from pending push/devil state — keep that in sync if you add modal fields.

---

## Optional: related symbols to grep

`rollPending`, `rollModal`, `handleRollWithSession`, `sessionRolls`, `active_session_detail`, `show_position_effect_to_players`, `characterAPI.rollAction`, `rollAPI.getRolls`.
