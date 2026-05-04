# Standard abilities — roll bonus audit (A/B/C/D)

Implementation: regex `+1d` / `+1 effect` plus curated overrides in [`frontend/src/features/character-sheet/utils/abilityRollBonusMeta.js`](../../frontend/src/features/character-sheet/utils/abilityRollBonusMeta.js). Fixture source: [`backend/src/characters/fixtures/standard_abilities.json`](../../backend/src/characters/fixtures/standard_abilities.json).

| Bucket | Meaning |
|--------|---------|
| **A** | Conditional action bonus — tick only when fiction matches. |
| **B** | Resistance-related +1d (+ Iron Will: **Resolve-attribute** resistance only); sheet wiring see CharacterSheet. |
| **C** | Bonus applies to follow-up or **other actor** — suppressed from wrong UI surface. |
| **D** | Dual/split — two toggles from one ability; **different** situations; use judgment. |
| **—** | No `+1d` / `+1 effect` substring — not in roll bonus UI. |

## Scope decision (implemented hybrid)

- **Not** full Ability model metadata in Django for this pass (lower churn).
- **Yes** curated name lists in `abilityRollBonusMeta.js` (stable names from fixtures) + Iron Will on **RESOLVE** resistance dice only.
- **Yes** clearer roll-modal copy pointing players to the audit doc when needed.
- Hamon/Spin: same regex + honor system; many lines are **A**; see fixtures [`srd_hamon_abilities.json`](../../backend/src/characters/fixtures/srd_hamon_abilities.json), [`srd_spin_abilities.json`](../../backend/src/characters/fixtures/srd_spin_abilities.json) for full text. No extra suppressions beyond this file unless you extend `abilityRollBonusMeta.js`.

### Hamon / Spin (representative tagging)

Treat like standard **A** unless description is ally/follow-up: e.g. “They gain +1d” (**C**, ally next action), terrain/environment +1 effect (**A** when self), “+1d to resist poison…” (**B** until resistance UI wires heritage-style bonuses per attribute).

## Standard abilities (fixture order)

| Name | Bucket | Notes |
|------|--------|-------|
| Ambush | A | +1d hiding/trap |
| Cascade Effect | — | No pool keyword |
| Final Barrage | — | |
| Parry and Break | C | +1 effect is **after** resist, counterattack — **effect tick suppressed** in generic action modal; use **resistance result** follow-up: pick “Parry and Break — counterattack…”, choose action, **Open dice pool** (bakes +1 effect into that roll; see `CharacterSheet.jsx`) |
| Phantom Pain | — | |
| Savage | A | +1d command + frightened |
| Spin-Boosted Blow | D | +1d +1 effect same strike |
| Steady Barrage | A | Rapid-fire |
| Invigorated | A | Healing treatment |
| Legendary Guard | — | |
| Battleborn | — | |
| Swan Song | — | |
| Iron Will | B | +1d **Resolve resistance** only — **checkbox on RESOLVE resistance**; **dice suppressed** on action-roll modal |
| Tough as Nails | — | |
| Fortitude | — | |
| Overdrive | — | +1 armor, not roll |
| Masochist | — | |
| Undying Will | — | |
| Rule of Cool | — | |
| Bizarre Step | — | |
| Cloak & Dagger | A | Misdirection |
| Mesmeriser | — | |
| Saboteur | — | |
| Shadow | — | |
| Subterfuge | — | |
| Bizarre Intuition | — | |
| Focused | — | |
| Like Looking into a Mirror | — | |
| Mastermind | A | Gather bizarre info |
| Neural Lace | — | |
| Scout | D | Locate +1 effect vs hide +1d |
| Shared Vision | — | |
| Aura of Confidence | C | **Allies** — **dice tick suppressed** for self action modal |
| Notorious | — | |
| Scoundrel | A | Consort + engagement |
| Trust in Me | A | Intimate relationship |
| Foresight | — | |
| Bodyguard | D/B | Protect + resist +1d; gather +1 effect |
| Guardian | — | |
| Functioning Vice | — | |
| Stand Proud | C | **They** gain +1 effect/armor — **effect tick suppressed** self modal |
| Analyst | — | |
| Expertise | — | |
| Calculating | — | |
| The Devil's Footsteps | — | |
| Superhero Landing | A | Stylish aerial |
| Daredevil | D | +1d action vs −1d resistance (minus not automated) |
| Bizarre Improvisation | — | |
| Automatic Trigger | — | |
| Weapon Recall | — | |
| Stand Evolution | — | |
| Channel Force | — | |
| Requiem | — | |

## Related code

- Action roll modal: [`frontend/src/pages/CharacterSheet.jsx`](../../frontend/src/pages/CharacterSheet.jsx) (`supportsAbilityBonus*` + `abilityRollBonusMeta`).
