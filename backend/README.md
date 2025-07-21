# backend/

This directory contains the Django-based backend application for the 1-800-BIZARRE platform. It is responsible for managing all game data, business logic, and providing a RESTful API for the frontend application.

## Purpose

The primary purpose of this directory is to:
*   **Serve as the API Backend**: Expose a comprehensive set of API endpoints for character management, campaign management, game mechanics, and data retrieval.
*   **Manage Game Data**: Define and manage the database models for all game entities (e.g., Characters, Stands, Campaigns, NPCs, Abilities, Heritages, Vices, Traumas).
*   **Implement Business Logic**: Enforce game rules and validation, such as character creation constraints, XP advancements, and crew consensus mechanisms.
*   **Handle Authentication and Authorization**: Manage user accounts, login, registration, and ensure secure access to API resources.

## Key Contents

*   `src/`: The core Django project source code.
*   `requirements.txt`, `requirements-prod.txt`: Python dependency lists for development and production environments, respectively.
*   `package.json`, `package-lock.json`: Node.js related files, likely for development tools or scripts specific to the backend (e.g., linting, formatting, or build steps that involve Node.js).
*   `.env.example`: An example file for environment variables, typically used for sensitive information like database credentials or API keys.
*   `README.md`: This file, providing an overview of the backend.

## Code Quality and Structure

The backend follows a standard Django project structure, promoting:
*   **Modularity**: Separation of concerns into distinct Django apps (e.g., `characters` for game-specific logic).
*   **Maintainability**: Clear organization of models, views, serializers, and tests within their respective apps.
*   **Scalability**: Designed to handle API requests efficiently and manage a growing dataset of game information.

## Logic Behind Decisions

The decision to use Django and Django REST Framework for the backend is based on their robustness, extensive features, and the rapid development capabilities they offer for building powerful web APIs. Django's robust ecosystem provides excellent tools for data management and business logic implementation.

**Note on "Logic Behind Decisions"**: The explanations regarding decision logic primarily reflect discussions from the current chat session and general software engineering best practices. This document does not have access to the full history of all previous, unlogged interactions or design discussions that may have influenced the project's evolution.
