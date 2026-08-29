# Stand Coin mechanics contract (SRD_DEV)

Source: [`1-(800)-BIZARRE SRD_DEV.md`](1-\(800\)-BIZARRE%20SRD_DEV.md) (canonical for this rollout).

## Roll stats vs passives

| Category | Stats | Dice |
|----------|-------|------|
| **Stand Coin rolls** | Power, Speed, Precision | Active pools when fiction is Stand-scale (`parallel to user skill checks`, not additive). |
| **Stand Coin rolls** | Durability | Same grade→dice table; fiction is **Stand taking a hit** (resistance-shaped stress math). |
| **Passives** | Range, Development | No dice; GM reads tiers for distance / XP growth. |

## Grade → dice (A/B/C/D/F)

Matches SRD_DEV table: A=4d, B=3d, C=2d, D=1d, **F=0d (gated / use 2d keep lower when pool resolves to 0)**. **S**: treat as **4d** cap (no fifth die).

## Resistance

- **User consequences:** Insight / Prowess / Resolve; existing attribute resistance flow.
- **Stand hit:** **Durability** pool. Same stress table as user resistance: `6 − highest` (a 6 costs 0). Two or more 6s: pay 0 and **clear 1 stress**. 0-dice cannot crit.

## API surface

- **`POST /characters/{id}/roll-action/`** with `pool_source: "stand_coin"` and **`stand_stat`**: `power` | `speed` | `precision` (Durability is resistance, not an action roll).
- **`action`** body should mirror `stand_{stat}` for logs (e.g. `stand_power`).
- Push / Devil / Assist / bonuses follow same exclusion rules unless product extends them later; Ripple Breathing waive **does not** apply to stand coin rolls.

## Old → new mapping

| Before | After |
|--------|--------|
| Stand stats UI for armor/stress/session XP blurbs | Same grades drive stand **action** pools + **durability resist** previews; **PC stress stays 9 boxes** — Durability only adjusts **Stand armor** (+ resist depth), not stress length. |
| `roll-action` reads only `action_dots` | Optionally reads **Stand / `coin_stats`** when `pool_source=stand_coin`. |
| Resistance only Insight/Prowess/Resolve | Add **Durability** path when resisting **Stand** consequences. |
