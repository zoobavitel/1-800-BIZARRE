# SRD Integration

This document outlines how the Standard Reference Document (SRD) is integrated into the 1-800-BIZARRE platform, covering the canonical rules source, data loading, backend validation, and test coverage.

## Canonical SRD and Rules Reference

* **Official SRD (full text):** `docs/1(800)-Bizarre SRD.txt` — The complete 1(800)Bizarre Game Rules SRD. Use this for full wording, examples, heritage tables, playbook abilities, entanglements, and every rule in detail.
* **Structured rules reference:** `docs/GAME_RULES.md` — A concise, scannable rules reference derived from the SRD. Use this for quick lookup during development or at the table; it points back to the SRD for extended content.

All game mechanics implemented in the backend, fixtures, and tests should align with the SRD and can be cross-checked against `GAME_RULES.md`.

## SRD Data (Fixtures)

The `backend/src/characters/fixtures/` directory contains several JSON files prefixed with `srd_` (e.g., `srd_benefits.json`, `srd_heritages.json`). These files serve as Django fixtures and are loaded as initial data into the database. They provide the foundational rules and content for various game elements, such as:

*   **`srd_benefits.json`**: Defines character benefits that can be acquired.
*   **`srd_detriments.json`**: Defines character detriments.
*   **`srd_hamon_abilities.json`**: Lists abilities specific to Hamon users.
*   **`srd_heritages.json`**: Details different character heritages.
*   **`srd_spin_abilities.json`**: Lists abilities specific to Spin users.
*   **`srd_traumas.json`**: Defines various character traumas.

These fixtures ensure that the core game data, as defined by the SRD, is consistently available within the application.

## Backend Validation

The backend models and serializers incorporate validation logic to enforce the rules and constraints specified in the SRD. This ensures data integrity and adherence to game mechanics. For example, character creation and progression are validated against rules such as:

*   **Action Dot Distribution**: Limits on the number of action dots a character can allocate at different levels.
*   **Stand Coin Point Allocation**: Rules governing the distribution of points for Stand stats (Power, Speed, Range, Durability, Precision, Development).
*   **Stress Calculation**: How a character's stress is determined based on their Stand's durability.
*   **Ability Counts**: The number of abilities a character can have, often influenced by their Stand's rank (e.g., A-rank Stands granting additional abilities).

## Test Coverage

The `backend/src/characters/tests/` directory contains unit tests that specifically verify the backend's adherence to the SRD rules. These tests act as a crucial safeguard, ensuring that any changes to the codebase do not inadvertently break game mechanics.

Key test files include:

*   **`test_pc_validation.py`**: This file contains comprehensive tests for Player Character (PC) validation. It verifies that:
    *   New characters are created with the correct initial action dots and Stand Coin points.
    *   Action dot limits per skill are enforced.
    *   Stand Coin point totals and individual stat grades are valid.
    *   Stress values align with Stand Durability.
    *   The correct number of abilities are assigned based on character level and Stand ranks.
    *   Attribute ratings are correctly calculated from action dots.

*   **`test_npc_validation.py`**: Focuses on Non-Player Character (NPC) validation, ensuring NPCs adhere to their specific SRD-defined rules.

*   **`test_crew_name_consensus.py`**: Tests the logic related to crew name consensus, which might have SRD-defined rules for how crews are formed or named.

These tests directly reflect the rules outlined in the SRD, providing a programmatic guarantee that the application's logic aligns with the game's design.

## Where to Find the Rules

The **definitive source** of game rules is the text SRD:

* **`docs/1(800)-Bizarre SRD.txt`** — Full ruleset, lore, and mechanics for 1(800)Bizarre (core system, skills, Stand Coin, stress/trauma, skill checks, position & effect, consequences, resistance, flashbacks, clocks, fortune, gathering information, coin & stash, reputation, advancement, combat, teamwork, claims, downtime, payoff, wanted level, entanglements, downtime activities, vice, character creation, heritages, Stand/Spin/Hamon playbooks, and resources).

For quick reference and implementation checks, use **`docs/GAME_RULES.md`**, which summarizes these rules and links back to the SRD for detail.

The backend logic, data fixtures, and test suite are designed to implement and enforce the rules described in the SRD. When implementing new features or changing mechanics, consult the SRD (and optionally `GAME_RULES.md`) as the authoritative source.
