---
name: effect-tier-vocabulary
description: Canonical effect tiers limited/standard/extreme in API and UI; legacy greater only in normalize_effect. Use when editing roll effects, session defaults, serializers, or CharacterSheet/CampaignManagement dropdowns.
---

# Effect tier vocabulary

## When to use

- Adding or editing effect dropdowns, serializers, `Session.default_effect`, `Roll.effect`, or display labels.

## Instructions

- Store and send **`limited`**, **`standard`**, **`extreme`** — never **`greater`** in new code.
- **`roll_helpers.normalize_effect`** maps legacy `greater`/`great` → `extreme` for reads and inbound data.
- Display text can say **“Extreme”**; stored value is **`extreme`**.
- Grep for accidental `greater` in new UI: `value="greater"` in forms.

## Reference

`backend/src/characters/roll_helpers.py` — `normalize_effect`, `EFFECT_ORDER`.
