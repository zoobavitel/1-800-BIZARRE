Non-Player Characters (NPCs)
Non-Player Characters (NPCs) provide flexible, streamlined foes and allies for the GM, using a subset of PC mechanics optimized for rapid play.

## 1. Key Differences from Player Characters

*   **No Stress or Trauma:** NPCs do not track Stress or Trauma.
*   **No Action Ratings or Attributes:** NPCs have no action dots (skills) or attributes (Insight, Prowess, Resolve). Their capabilities derive solely from Stand Coin stats and narrative context.
*   **No XP or Advancement:** NPCs do not earn or spend XP. Their level is fixed at creation based on Stand Coin points.
*   **No Push Yourself:** Mechanics that spend Stress to push for extra dice or effect do not apply.
*   **Configurable Harm Clock:** NPCs have a Harm Clock that defaults to 4 segments but can be configured by the GM.
*   **Durability-Based Vulnerability Clock:** All NPCs have a Vulnerability Clock whose size is determined by their Durability stat.

## 2. NPC Stand Coin Stats

NPCs still possess Stand Coin stats, but only four have direct mechanical impact; the others serve as narrative descriptors:

*   **Power:** Determines harm level inflicted: S/A → Level 4, B → 3, C → 2, D → 1, F → 0.

*   **Speed (Movement):** Translates directly into the NPC's movement speed.
    *   S: 200 ft
    *   A: 60 ft
    *   B: 40 ft
    *   C: 35 ft
    *   D: 30 ft
    *   F: 25 ft
    *   *Note: Initiative and action order are GM’s call—no rolls.*

*   **Range:** Defines the operational distance of the NPC's Stand and its abilities. This is primarily a narrative guideline for the GM.
    *   S: Unlimited range, no range penalties
    *   A: 100 ft
    *   B: 50 ft
    *   C: 40 ft
    *   D: 20 ft
    *   F: 10 ft

*   **Durability:** Determines the Vulnerability Clock size and Armor charges.
    *   **Vulnerability Clock Conversion:**
        *   **S:** 0-segment clock (Special Durability - cannot be defeated by normal harm; requires alternative win condition)
        *   **A:** 12-segment clock
        *   **B:** 10-segment clock
        *   **C:** 8-segment clock
        *   **D:** 6-segment clock
        *   **F:** 4-segment clock
    *   **Armor System:**
        *   **Regular Armor Charges** (reduce harm/consequences by 1):
            *   **S:** 5 charges
            *   **A:** 4 charges
            *   **B:** 4 charges
            *   **C:** 3 charges
            *   **D:** 2 charges
            *   **F:** 1 charge
        *   **Special Armor Charges** (completely negate harm/consequences):
            *   **S, A:** 3 charges
            *   **B:** 2 charges
            *   **C, D:** 1 charge
            *   **F:** 0 charges

*   **Precision:** For NPCs, Precision is a narrative descriptor of their accuracy and control. It does not have mechanical implications as NPCs do not make action rolls.
*   **Development:** For NPCs, Development Potential is a narrative descriptor of their growth potential. It does not have mechanical implications as NPCs do not gain XP.

## 3. NPC Level

Calculate an NPC’s level from its total Stand Coin points (S = 5, A = 4, B = 3, C = 2, D = 1, F = 0):

`level = 1 + max(0, total_points - 10)`

(An NPC with 10 points is level 1; each point above 10 adds +1 level.)

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
*   `--harm_clock_max <segments>`: The maximum segments for the NPC's Harm Clock. Default: 4

**Example Usage:**
```bash
source ~/.virtualenvs/jojo/bin/activate
python backend/src/manage.py create_npc "The Shadow Broker" 1 1 --power A --speed B --durability C --range B --harm_clock_max 6
```
This will create an NPC named "The Shadow Broker" in campaign 1, created by user 1, with the specified Stand Coin stats and a 6-segment Harm Clock. Its level and vulnerability clock will be automatically calculated.

## 5. GMing NPCs

When running NPCs, the GM should prioritize narrative and dramatic effect over strict adherence to numerical values, especially for stats like Speed and Range.

*   **Focus on Narrative:** Use the NPC's stats to inform your descriptions of their actions and capabilities.
*   **GM Judgment:** Decide when an NPC acts, how effectively they use their abilities, and what consequences arise, based on the fiction and the desired dramatic tension.
*   **Clocks for Conflict:** Utilize Harm Clocks and Vulnerability Clocks to track progress in conflicts with NPCs, promoting urgency and clear outcomes. All clocks are configured by the GM and are intended to be displayed as indicators to the player characters.
*   **Special Durability (S-Rank):** For NPCs with S-rank Durability, remember they cannot be defeated by direct damage. Instead, create clocks for alternative win conditions (e.g., "Expose the User," "Discover Weakness," "Break Will").
*   **User as Target:** Consider having a separate, smaller clock for the NPC's user if they are vulnerable, offering players a strategic choice.