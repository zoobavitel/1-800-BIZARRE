# backend/src/

This directory contains the core source code for the Django backend application. It follows a typical Django project layout, organizing the application's components into distinct apps and managing project-level settings and URLs.

## Purpose

The primary purpose of this directory is to:
*   **House Django Project Files**: Contain the main Django project configuration (`app/`) and individual Django applications (e.g., `characters/`).
*   **Manage Project-Level Scripts**: Include `manage.py` for running Django administrative tasks.
*   **Provide Utility Scripts**: Store various Python scripts used for development, data manipulation, or testing outside of the main application flow.

## Key Contents

*   `app/`: The main Django project configuration, including settings, URL routing, WSGI, and ASGI configurations.
*   `characters/`: A Django application dedicated to managing game-specific entities like characters, campaigns, NPCs, abilities, and their associated logic.
*   `manage.py`: Django's command-line utility for administrative tasks (e.g., running the development server, managing migrations, running tests).
*   `check_*.py`, `create_*.py`, `rename_*.py`: Various utility scripts for data checks, character creation, and other specific tasks. These are often temporary or for development purposes, and include scripts like `create_mf_doom_characters.py` (which was created and then deleted during our interaction) and `assign_characters.py`.


## Code Quality and Structure

This directory adheres to Django's recommended project structure, which promotes:
*   **Separation of Concerns**: Core project settings are isolated from application-specific logic.
*   **Modularity**: Individual applications (like `characters`) can be developed and maintained independently.
*   **Clarity**: The organization makes it easy to understand where different parts of the application reside.

## Logic Behind Decisions

The decision to follow Django's standard project structure is based on best practices for maintainability, scalability, and developer familiarity. Grouping related functionalities into distinct Django apps (e.g., `characters`) allows for better organization and easier management of a growing codebase. Utility scripts are placed here for convenient access during development and debugging.

**Note on "Logic Behind Decisions"**: The explanations regarding decision logic primarily reflect discussions from the current chat session and general software engineering best practices. This document does not have access to the full history of all previous, unlogged interactions or design discussions that may have influenced the project's evolution.