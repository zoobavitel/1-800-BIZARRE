# docs/

This directory serves as the central repository for all project documentation, encompassing technical specifications, architectural overviews, API usage guides, and game-specific rules derived from the Standard Reference Document (SRD).

## Purpose

The primary purpose of this directory is to:
*   **Provide Comprehensive Documentation**: Offer detailed explanations of the project's various components, functionalities, and underlying logic.
*   **Centralize Information**: Act as a single source of truth for all project-related documentation, making it easy for developers, designers, and users to find relevant information.
*   **Support Onboarding**: Facilitate the onboarding of new team members by providing clear and structured documentation of the codebase and game rules.
*   **Integrate SRD**: Directly host or reference the official game rules (SRD), ensuring that the application's implementation aligns with the game design.

## Key Contents

*   `backend_documentation.md`: Comprehensive documentation on the backend's architecture, core functionalities (e.g., character creation, crew consensus, NPC differences), and API endpoints.
*   `SRD_INTEGRATION.md`: Details how the Standard Reference Document (SRD) is integrated into the platform, covering data loading, backend validation, and test coverage.
*   `INTERACTION_SUMMARY.md`: A log of the interactions and tasks performed during the current chat session, serving as a historical record of development decisions and progress.
*   `API_USAGE.md`, `BACKEND_INTEGRATION.md`, `development.md`: Other technical documentation files covering API usage, backend integration details, and development guidelines.
*   PDF files (e.g., `Character Creation.pdf`, `Combat & Initiative.pdf`, `Hamon Playbook.pdf`): These are the official SRD documents, detailing the complete ruleset, lore, and mechanics of the Jojo TTRPG. They are the definitive source for game rules.

## Code Quality and Structure

Organizing documentation in a dedicated `docs/` directory is a standard practice in software development. This structure promotes:
*   **Accessibility**: Documentation is easily found and separated from source code.
*   **Maintainability**: Documentation can be updated independently of code changes.
*   **Completeness**: Encourages thorough documentation by providing a clear place for all project knowledge.

## Logic Behind Decisions

The decision to centralize documentation in the `docs/` directory is driven by the need for clear communication and knowledge sharing within the project. Given the complexity of a TTRPG system, comprehensive documentation is essential for developers to understand the game rules and backend logic. Directly including SRD PDFs and detailed markdown files ensures that all team members have access to the necessary information to build and maintain the platform effectively.

**Note on "Logic Behind Decisions"**: The explanations regarding decision logic primarily reflect discussions from the current chat session and general software engineering best practices. This document does not have access to the full history of all previous, unlogged interactions or design discussions that may have influenced the project's evolution.