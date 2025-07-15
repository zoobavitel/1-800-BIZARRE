# NPC Creation and Rules

This document outlines the specific rules and guidelines for creating and utilizing Non-Player Characters (NPCs) within the game system, emphasizing their distinct mechanics compared to Player Characters (PCs).

## 1. Key Differences from Player Characters

NPCs are designed to be simpler and more flexible for the Game Master (GM) to run. They do not utilize the full suite of PC mechanics.

*   **No Stress:** NPCs do not have a Stress track.
*   **No Action Ratings/Attributes:** NPCs do not have action dots or attribute ratings (Insight, Prowess, Resolve). Their effectiveness in the fiction is determined by their narrative role, level, and Stand Coin stats.
*   **No XP/Advancement:** NPCs do not gain or spend XP in the same way PCs do. Their level is determined at creation based on their Stand Coin points.
*   **No "Push Yourself" Mechanics:** Mechanics tied to "pushing yourself" (which typically involve Stress) do not apply to NPCs.
*   **Simplified Harm:** NPCs use a simplified Harm Clock system instead of the multi-level Harm track of PCs.
*   **Vulnerability Clock:** NPCs have a fixed 4-segment Vulnerability Clock.

## 2. NPC Stand Coin Stats

NPCs possess Stand Coin stats, but their mechanical interpretation differs significantly from PCs. Only Power, Speed, Range, and Durability have direct mechanical implications for NPCs. Precision and Development are primarily narrative descriptors.

*   **Power:** Determines the harm level and impact of the NPC's attacks.
    *   S: Level 4 harm, can force position to be lowered by one (desperate to risky, risky to controlled)
    *   A: Level 4 harm
    *   B: Level 3 harm
    *   C: Level 2 harm
    *   D: Level 1 harm
    *   F: No significant harm

*   **Speed (Movement):** Translates directly into the NPC's movement speed.
    *   S: 200 ft
    *   A: 60 ft
    *   B: 40 ft
    *   C: 35 ft
    *   D: 30 ft
    *   F: 25 ft
    *   *Note: The "acts before" rules are GM judgment calls and not tied to the NPC object itself. NPCs do not roll for initiative.*

*   **Range:** Defines the operational distance of the NPC's Stand and its abilities. This is primarily a narrative guideline for the GM.
    *   S: Unlimited range, no range penalties
    *   A: 100 ft
    *   B: 50 ft
    *   C: 40 ft
    *   D: 20 ft
    *   F: 10 ft

*   **Durability:** Affects the NPC's Harm Clock size and Armor Charges.
    *   **Harm Clock Conversion:**
        *   **S:** 0-segment clock (Special Durability - cannot be defeated by direct damage; requires alternative win condition)
        *   **A:** 12-segment clock
        *   **B:** 10-segment clock
        *   **C:** 8-segment clock
        *   **D:** 6-segment clock
        *   **F:** 4-segment clock
    *   **Armor Charges:**
        *   **S, A:** 3 Armor charges
        *   **B:** 2 Armor charges
        *   **C, D:** 1 Armor charge
        *   **F:** 0 Armor charges

*   **Precision:** For NPCs, Precision is a narrative descriptor of their accuracy and control. It does not have mechanical implications as NPCs do not make action rolls.
*   **Development Potential:** For NPCs, Development Potential is a narrative descriptor of their growth potential. It does not have mechanical implications as NPCs do not gain XP.

## 3. NPC Level

An NPC's level is directly derived from the total points distributed among their six Stand Coin stats (Power, Speed, Range, Durability, Precision, Development).

*   **Point Values:**
    *   S: 5 points
    *   A: 4 points
    *   B: 3 points
    *   C: 2 points
    *   D: 1 point
    *   F: 0 points
*   **Level Calculation:**
    *   A Level 1 NPC has exactly 10 Stand Coin points.
    *   For every 5 points above 10, the NPC gains one level.
    *   Formula: `level = 1 + floor((total_points - 10) / 5)` (if total_points > 10, otherwise 1)

## 4. Creating NPCs (Using the CLI Tool)

A management command `create_npc` is available to facilitate NPC creation.

**Command:**
`python backend/src/manage.py create_npc <name> <campaign_id> <creator_id> [options]`

**Arguments:**
*   `<name>`: The name of the NPC (string).
*   `<campaign_id>`: The ID of the campaign the NPC belongs to (integer).
*   `<creator_id>`: The ID of the user creating the NPC (integer).

**Options:**
*   `--power <grade>`: Stand Power rating (S, A, B, C, D, F). Default: D
*   `--speed <grade>`: Stand Speed rating (S, A, B, C, D, F). Default: D
*   `--range <grade>`: Stand Range rating (S, A, B, C, D, F). Default: D
*   `--durability <grade>`: Stand Durability rating (S, A, B, C, D, F). Default: D
*   `--precision <grade>`: Stand Precision rating (S, A, B, C, D, F). Default: F (Narrative only for NPCs)
*   `--development <grade>`: Stand Development Potential rating (S, A, B, C, D, F). Default: F (Narrative only for NPCs)

**Example Usage:**
```bash
source ~/.virtualenvs/jojo/bin/activate
python backend/src/manage.py create_npc "The Shadow Broker" 1 1 --power A --speed B --durability C --range B
```
This will create an NPC named "The Shadow Broker" in campaign 1, created by user 1, with the specified Stand Coin stats. Its level and harm clock will be automatically calculated.

## 5. GMing NPCs

When running NPCs, the GM should prioritize narrative and dramatic effect over strict adherence to numerical values, especially for stats like Speed and Range.

*   **Focus on Narrative:** Use the NPC's stats to inform your descriptions of their actions and capabilities.
*   **GM Judgment:** Decide when an NPC acts, how effectively they use their abilities, and what consequences arise, based on the fiction and the desired dramatic tension.
*   **Clocks for Conflict:** Utilize Harm Clocks and Vulnerability Clocks to track progress in conflicts with NPCs, promoting urgency and clear outcomes.
*   **Special Durability (S-Rank):** For NPCs with S-rank Durability, remember they cannot be defeated by direct damage. Instead, create clocks for alternative win conditions (e.g., "Expose the User," "Discover Weakness," "Break Will").
*   **User as Target:** Consider having a separate, smaller clock for the NPC's user if they are vulnerable, offering players a strategic choice.
