# backend/src/characters/fixtures/

This directory contains JSON fixture files used by the Django `characters` application. These fixtures are primarily used for populating the database with initial data, especially data derived from the Standard Reference Document (SRD), and for providing consistent test data.

## Purpose

The primary purpose of this directory is to:
*   **Initial Data Population**: Load essential game data (e.g., heritages, abilities, vices, traumas) into the database when the application is first set up or when migrations are run.
*   **SRD Integration**: Serve as the direct integration point for core game rules and data defined in the SRD, ensuring that the application's foundational data aligns with the game's design.
*   **Testing**: Provide a reliable and consistent set of data for unit and integration tests, ensuring that tests run against a known state and that game logic is validated against expected SRD values.

## Key Contents

*   `srd_benefits.json`, `srd_detriments.json`, `srd_hamon_abilities.json`, `srd_heritages.json`, `srd_spin_abilities.json`, `srd_traumas.json`: These files contain data directly extracted or derived from the SRD, defining various game elements like character benefits, detriments, abilities specific to Hamon and Spin users, heritages, and traumas.
*   `standard_abilities.json`: Contains data for general abilities available to characters.
*   `example_campaign.json`, `initial_data.json`, `jack_rice_fixture.json`: These are likely used for setting up specific test scenarios or providing initial default data for campaigns and characters.
*   `heritages_updated.json`: Suggests an updated version of heritage data, possibly for migration or specific testing.

## Code Quality and Structure

Placing fixtures in a dedicated `fixtures/` directory within a Django app is a standard and recommended practice. This organization:
*   **Centralizes Data**: Keeps all initial and test data in a well-defined location.
*   **Separates Data from Code**: Clearly distinguishes data definitions from application logic.
*   **Facilitates Management**: Makes it easy to manage, update, and load data using Django's `loaddata` management command.

## Logic Behind Decisions

The decision to use Django fixtures for SRD data is crucial for maintaining data integrity and consistency with the game's rules. By loading SRD data directly from these JSON files, the application ensures that core game elements are always aligned with the source material. This approach also simplifies testing, as tests can rely on a predictable dataset. The use of separate fixture files for different data types (e.g., `srd_benefits.json` vs. `srd_heritages.json`) promotes modularity and easier management of individual data sets.

**Note on "Logic Behind Decisions"**: The explanations regarding decision logic primarily reflect discussions from the current chat session and general software engineering best practices. This document does not have access to the full history of all previous, unlogged interactions or design discussions that may have influenced the project's evolution.
