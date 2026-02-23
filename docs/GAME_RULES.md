# 1(800) Bizarre — Game Rules Reference

This document is the structured rules reference for the platform, derived from the **1(800)-Bizarre SRD** (`1(800)-Bizarre SRD.txt`). For full wording, examples, and extended content (heritages, playbook abilities, entanglements), use the SRD.

---

## Overview

**The game:** 1(800)Bizarre is about stylish weirdos, personal powers, and missions that never go to plan. We play to find out whether they can hold it together when everything falls apart.

**The structure:** Four phases—**free play** (talk, go places, roll as needed), **the mission** (tension, combat, chases, rolls to overcome obstacles), **downtime** (payoff, wanted level, entanglements, PC activities), then back to free play.

**Judgment calls:**
- **Players have final say:** Which skills are reasonable; whether events match XP triggers.
- **GM has final say:** How dangerous/effective a skill is; which consequences apply; whether a roll is needed and which one.

---

## Core System

### Dice
- **d6 only.** Roll a pool and read the **single highest** die.
- **6:** Full success. Two 6s = critical (extra advantage).
- **4 or 5:** Partial success—you do it but with consequences.
- **1–3:** Bad outcome; usually no goal and complications.
- **Zero or negative dice:** Roll 2d and take the **lowest**. No criticals with zero dice.

### Dice pool
- Built from **skill rating** or **attribute** (e.g. Finesse, Prowess). Usually 1–4 dice.
- **Four main roll types:** Skill check, Downtime roll, Fortune check, Resistance check.

---

## Skills & Attributes

### Skills (12)
| Skill     | When you use it |
|----------|------------------|
| Bizarre  | Open mind to paranormal power; communicate with bizarre entities. |
| Command  | Compel swift obedience; intimidate; lead group actions. |
| Consort | Socialize with friends/contacts; access resources, information, people, places. |
| Finesse  | Dextrous manipulation; subtle misdirection; pick pockets; duel; drive. |
| Hunt     | Track a target; ambush; precision/aimed attack. |
| Prowl    | Move skillfully and quietly; sneak; strike from hiding. |
| Skirmish | Close combat; brawl; wrestle; hold position. |
| Study    | Scrutinize details; research; detect lies or true feelings. |
| Survey   | Observe situation; anticipate outcomes; spot trouble or opportunities. |
| Sway     | Influence with guile, charm, or argument; lie; persuade. |
| Tinker   | Fiddle with devices; create/alter gadgets; pick locks; disable alarms. |
| Wreck    | Savage force; smash; sabotage; chaos. |

- Each skill has a **rating 0–4** = number of dice when performing that skill.
- **Skill checks** only when the action is dangerous or troublesome.

### Attributes (3)
- **Insight, Prowess, Resolve.** Rating 0–4 each, from action-dot columns on the playbook.
- Used for **resistance checks** (and vice rolls). Each attribute resists a type of danger:
  - **Insight:** Deception, understanding.
  - **Prowess:** Physical strain, injury.
  - **Resolve:** Mental strain, willpower.
- **0 dice in an action:** Roll 2d and take the **lower** result.

---

## Stand Coin (PC)

Six properties, rated **F (0), D (1), C (2), B (3), A (4), S (special)**. At creation, distribute **6 points** among:

| Stat        | Meaning |
|------------|--------|
| Power      | Physical destructive power; vs enemy Durability sets potency. |
| Speed      | Initiative and mobility; movement and who acts first. |
| Range      | Operational distance of Stand and abilities. |
| Durability | Stress capacity, armor charges, Stand armor effectiveness. |
| Precision  | Accuracy and control; modifies position/effect by grade. |
| Development| Growth potential; XP per session and ability flexibility. |

**Constraints:** Minimum one stat must be D or higher (no all-F).  
**Potency:** When Power > Enemy Durability, +1 effect; when Power < Enemy Durability, you lack potency.  
Full grade tables (movement, range, stress/armor by grade, Precision effects, Development XP) are in the SRD.

---

## Stand Coin (NPC)

- **Power:** Sets harm level and when position is worsened (controlled→risky→desperate).
- **Speed:** Movement only (initiative is GM’s call).
- **Range:** Narrative/operational distance.
- **Durability:** **Vulnerability Clock** size (S=0/alt win, A=12, B=10, C=8, D=6, F=4 segments). **Regular armor** and **Special armor** charges by grade (see SRD). GM spends armor before filling clock.
- **Precision / Development:** Narrative for NPCs.

---

## Stress & Trauma

- **Stress:** Spend it to **resist** consequences (see Resistance). Also **push yourself:** for each option, take **2 stress** (each once per action): +1d, +1 effect, or act when incapacitated.
- **Trauma:** When you mark your **last** stress box, take **trauma**—circle one condition. You’re taken out of the conflict; when you return, stress is 0 and vice is satisfied.
- **Trauma conditions (pick one when you take trauma):** Cold, Haunted, Obsessed, Paranoid, Reckless, Soft, Unstable, Vicious.
- **Fourth trauma:** Character must retire (different life or take the fall for crew wanted level).

---

## Skill Checks

1. Player states **goal** and chooses **skill**.
2. GM sets **position** (controlled / risky / desperate) and **effect** (limited / standard / great).
3. Add **bonus dice:** up to +1d from **assist** (teammate takes 1 stress), and +1d from **push yourself (2 stress)** or **Devil’s Bargain** (not both for that second die).
4. Roll; interpret by position.

**Result by position (summary):**
- **Controlled:** 6 = do it; 4/5 = hesitate or minor consequence; 1–3 = falter.
- **Risky:** 6 = do it; 4/5 = do it with consequence (e.g. harm 2); 1–3 = things go badly.
- **Desperate:** 6 = do it; 4/5 = do it with severe consequence (e.g. harm 3); 1–3 = worst outcome.

**Devil’s Bargain:** GM or any player may offer +1d for a cost (collateral damage, sacrifice item, betray, faction trouble, clock tick, +2 Wanted Stars, harm, etc.). Bargain happens regardless of roll. Player may refuse and push themselves instead.

---

## Position & Effect

- **Position:** How bad consequences are (controlled → risky → desperate).
- **Effect:** How much the action accomplishes; maps to **clock segments:** Zero = 0, Limited = 1, Standard = 2, Great = 3, Extreme = 4+.
- **Against NPCs:** Players do not deal harm to NPCs. The effect of a successful roll fills an NPC’s clock (vulnerability, harm, or narrative clock): limited = 1 tick, standard = 2, greater = 3. Only the GM applies these ticks (e.g. via the apply-effect API).
- **Threat tiers (clocks):** Tier 0 (mooks, no clock), Tier I (4), Tier II (6), Tier III (8), Tier IV (10–12). See SRD for examples.
- **Factors:** Potency, quality, scale can adjust effect (and position trades). +1 effect abilities apply after GM sets effect; push yourself can add +1 effect (2 stress).

---

## Consequences & Harm

**Types:** Reduced effect, Complication (trouble/clocks), Lost opportunity, Worse position, **Harm**.

**Harm:** Record by level. **Lesser (1)** bottom row, **Moderate (2)** middle, **Severe (3)** top. If a row is full, harm moves up. Top row full + more harm → catastrophic (e.g. death).  
**Examples:** Fatal (4): Electrocuted, Drowned. Severe (3): Impaled, Broken Leg. Moderate (2): Deep Cut, Concussion. Lesser (1): Battered, Drained.  
**Direction:** NPCs can deal harm to players (GM applies via take-harm). Players do not deal harm to NPCs; their success fills NPC clocks by effect (see Position & Effect).

---

## Resistance & Armor

- **Resist:** Declare resistance; consequence is reduced or avoided (GM says which). Then roll **resistance check** with the appropriate attribute.
- **Stress cost:** **6 minus highest die.** Critical on resistance also clears 1 stress. You cannot fail a resistance check.
- **One roll per consequence.** GM may allow resisting multiple consequences (separate rolls).
- **Armor:** Mark an armor box to reduce or avoid a consequence instead of resisting. Restored when you choose load for the next score.
- **Death:** Level 4 harm unresisted, or need to mark level 3 when that row is already full (catastrophic consequence).

---

## Flashbacks

- During a mission, you can **flashback** to a past action that affects the present. GM sets **stress cost**: 0 (easy), 1 (complex/unlikely), 2+ (elaborate). Then resolve like a normal action (roll if needed). Cannot undo something that just happened in the present.

---

## Progress Clocks

- Circles with segments to track ongoing effort or impending danger. **4** = complex, **6** = more so, **8** = daunting. Name the **obstacle**, not the method. Types: danger clocks, racing clocks, linked clocks, mission clocks, tug-of-war, long-term projects (e.g. 8 segments base). See SRD for examples.

---

## Fortune Checks

- GM uses when outcome is uncertain and no other roll fits, or to disclaim decisions (e.g. faction outcomes). Build pool from a trait (Tier, quality, magnitude, etc.) or 1–4d. **6** = good/standard, **4/5** = mixed/limited, **1–3** = bad. Critical = exceptional.

---

## Gathering Information

- State how you gather info; GM answers or calls for a **skill check** or **fortune check**. Effect level sets detail: Great = exceptional; Standard = good; Limited = partial. Long investigations can be long-term projects; when the clock fills, ask questions as if great effect.

---

## Coin & Stash

- **Coin:** Abstract cash. 1 = week’s wages; 2 = small business week; 4 = month; 6 = jewels, car; 8 = good monthly take; 10 = property/deed. **Over 4 coin** must be spent or stashed before next score.
- **Uses:** 1 coin = +1 downtime activity; 1 coin = improve one downtime roll result; avoid some entanglements; stash for retirement.
- **Stash:** At retirement, 0–10 = poor, 11–20 = meager, 21–39 = modest, 40 = fine (see SRD). Moving to stash = fortune roll; removing stash = 2 stash → 1 coin.

---

## Reputation

- **Status** with factions: -3 (War) to +3 (Allies). Zero = neutral. Changes from scores and choices. At **War**: +1 Stars from scores, lose 1 hold, PCs get one downtime action. See SRD for full tier descriptions.

---

## Advancement

- **During session:** Mark 1 XP in the attribute for a **desperate** skill check.
- **End of session:** Per trigger, 1 XP if it happened, 2 XP if a lot: playbook trigger; expressed beliefs/drives/heritage/background; struggled with vice or traumas. XP can go to any track. **Training (downtime):** Mark 1 XP in playbook, once per downtime per track.
- **Spend:** 5 XP = +1d skill; 10 XP = +1 Stand Coin stat, heritage ability, or +2d in one skill. Fill track → clear and take an advance (ability or skill dot).

---

## Combat & Initiative

- **Order:** By **Speed** grade (higher Speed acts first). All-Out-Brawls and showdowns come from missions or entanglements (e.g. Wanted Level).

### Actions in combat
1. Declare intent and approach.
2. Describe how Stand/ability does it (action rating). Group action: pick leader; failed participants give leader 1 stress each.
3. GM sets **position** and **effect**.
4. Roll (action rating + 1d per assist). 1–3 = failure; 4–5 = success with consequences; 6 = success; 6,6 = critical (increase effect).

---

## Teamwork

- **Assist:** Help another’s roll; take 1 stress, give them +1d. One assistant per roll.
- **Lead group action:** Same action; best result counts for all; leader takes 1 stress per PC who rolled 1–3.
- **Protect:** Take a consequence meant for a teammate (may resist).
- **Set up:** Your action gives a teammate +1 effect or improved position on a follow-up.

---

## Claims

- Factions have claims (turf, artifacts, etc.). To **seize** a claim: pick one, GM details it and current holder; run a score; on success you take it, they lose it. Usually -2 status with target, +1 with their enemies. Losing your lair costs benefits until you restore or establish a new one. See SRD for full claim rules.

---

## Downtime

**Order:** 1) Payoff  2) Wanted Level  3) Entanglements  4) Downtime activities. Then back to free play.

### Payoff
- **Rep:** +1 or -1 with factions (or 0 if no one knows). **Coin** by job size: 2 (minor) to 10+ (major). Tithe to boss = Tier+1 coin or start a “patience” clock. GM gives what was earned—no surprise no-pay or trap.

### Wanted Level (Stars)
- 0–5+ stars by exposure. **Triggers:** +1 on hostile turf; +1 at war; +2 for killing high-profile target. **5 stars** → **All-Out-Brawl**; win = 0 stars and reset rep with that gang; lose = 1 trauma, then 0 stars and reset. **Over 5 in one mission** = Hot Pursuit; after Brawl, reset to (stars - 5). Reduce stars: declare All-Out-Brawl early, Bargain, or downtime activity.

### Entanglements
- After stars, GM picks or rolls (by wanted level) an entanglement. Resolve per type (Arrest, Cooperation, Bizarre Notice, Flipped, Reprisals, Rivals, Show of Force, Unquiet Dead, etc.). See SRD for full tables and resolution.

### Downtime activities
- **Two** per PC (one when at war). **+1 activity** = 1 coin or 1 rep. Options: **Long-term project**, **Recover**, **Reduce wanted level**, **Train**, **Indulge vice**. Same activity can be chosen twice. +1d if friend/contact helps; spend coin after roll to improve result by one step.

**Recover:** Roll (healer quality or action); tick healing clock. Fill clock → reduce each harm by one level, clear clock. New harm clears clock. Self-heal = 2 stress; no treatment = 1 stress, roll 0d.

**Reduce stars:** Say how, roll; 1–3 = clear 1, 4/5 = 2, 6 = 3, crit = 5.

**Train:** Mark 1 XP in playbook, once per downtime per track.

### Vice
- **Vice check:** Roll **lowest attribute**; clear stress = highest die. Overindulge if you clear more than you had. **Overindulge:** Attract Trouble (extra entanglement), Brag (+2 stars), Lost (play another PC until return), or Tapped (find new purveyor). If you don’t indulge and have trauma, take stress = trauma. Vice options: Faith, Gambling, Luxury, Obligation, Pleasure, Stupor, Weird.

---

## Character Creation (summary)

1. **Playbook:** Stand, Hamon, or Spin.
2. **Heritage:** Human, Rock Human, Vampire, Pillar Man, Gray Matter, Haunting, Cyborg, Oracle (see SRD for HP, benefits, detriments).
3. **Background:** Previous life and how you joined the crew.
4. **Action dots:** Assign **7** (max 2 per action at creation). Insight (Study, Survey, Tinker, Hunt); Prowess (Prowl, Skirmish, Finesse, Wreck); Resolve (Bizarre, Sway, Command, Consort).
5. **Stand/Hamon/Spin:** Type, **6 points** on Stand Coin (Power, Speed, Range, Durability, Precision, Development). Abilities: 3 unique (1 function each) or 1 unique (3 functions); A-ranks grant more (see SRD). Standard abilities + playbook options.
6. **Armor:** Per path (Stand/Hamon/Spin).
7. **Close friend and rival** from playbook.
8. **Vice** and purveyor.
9. **Name, alias, appearance.**
10. **XP triggers** (desperate rolls, beliefs, vice/trauma struggle).
11. **Load:** Light (1–3), Normal (4–5), Heavy (6), Encumbered (7–9).

---

## Heritages (summary)

Full **HP, required/optional detriments, benefit costs** are in the SRD. List: **Human** (0 base HP), **Rock Human** (2), **Vampire** (2), **Pillar Man** (1), **Gray Matter** (2), **Haunting** (2), **Cyborg** (2), **Oracle** (3).

---

## Playbooks (summary)

- **Stand:** A Stand’s form informs how it behaves, not what it can do. Five example builds (all 6-point spreads): **3 Little Birds** (Colony) P:D S:D R:C D:D Pr:D Dev:F; **Paint It Black** (Automatic) P:B S:F R:D D:D Pr:F Dev:D; **Nitro Burnin' Funny Car** (Tool-Bound) P:D S:C R:D D:D Pr:F Dev:D; **Lethal Injection** (Fighting Spirit) all D; **Dream Baby Dream** (Phenomena) P:F S:F R:C D:F Pr:F Dev:A. Start with 3 abilities; each A-rank in Coin stats unlocks 2 more (custom, playbook, or standard). Some abilities require a minimum number of A’s. Full unique abilities and recommended standard abilities are in the SRD.
- **Spin:** Foundations (Golden Arc, Vibrational Scan, Kinetic Tether, etc.); Cavalier, Executioner, Medico, Ballbreaker. Abilities gated by number of A-ranks. SRD has full text.
- **Hamon:** Foundations (Ripple Breathing, Overdrive, Zoom Punch, etc.); Traditionalist, Adaptive Flow, Cyber-Hamonist. Same A-rank gating. SRD has full text.

---

## References

- **Full SRD:** `docs/1(800)-Bizarre SRD.txt`
- **Platform integration:** `docs/SRD_INTEGRATION.md`
- **NPC rules:** `docs/NPC_CREATION_RULES.md`
- **Abilities (dev):** `docs/ABILITY_MANAGEMENT_SYSTEM.md`
