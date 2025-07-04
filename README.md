# Jojo TTRPG Platform

This is the root directory of the Jojo TTRPG Platform project. It serves as the central hub for both the frontend and backend applications, along with shared configurations, documentation, and scripts.

## Purpose

The primary purpose of this directory is to:
*   **Organize the Monorepo**: Act as the top-level container for the distinct `frontend` and `backend` services. This monorepo structure facilitates shared configurations, consistent development practices, and streamlined deployment.
*   **Provide Project-Wide Configuration**: Host configuration files that apply to the entire project, such as ESLint (`.eslintrc.json`), Git ignore rules (`.gitignore`), and TypeScript configuration (`tsconfig.json`).
*   **Manage Dependencies**: The `package.json` and `package-lock.json` files at this level manage development dependencies and scripts that might be used across both frontend and backend (e.g., for linting, formatting, or shared build processes).
*   **Offer High-Level Documentation**: The `README.md` (this file) provides an overview of the entire project, its structure, and how to get started.

## Key Contents

*   `.eslintrc.json`: ESLint configuration for consistent JavaScript/TypeScript code style.
*   `.gitignore`: Specifies intentionally untracked files to ignore by Git.
*   `package.json`, `package-lock.json`: Node.js project metadata and dependency management.
*   `tailwind.config.js`: Tailwind CSS configuration, potentially shared or influencing both frontend and backend if CSS is processed at this level.
*   `tsconfig.json`: TypeScript compiler configuration for the entire project.
*   `CUSTOM_ABILITIES_FINAL_REPORT.md`, `DYNAMIC_ABILITIES_COMPLETE.md`: Project-specific documentation or reports.
*   `backend/`: Contains the Django-based backend application.
*   `frontend/`: Contains the React-based frontend application.
*   `docs/`: Stores project documentation, including architectural overviews, API usage, and game-specific rules.
*   `scripts/`: Houses various utility scripts for deployment, setup, and other operational tasks.
*   `.github/`: Contains GitHub-specific configurations, such as CI/CD workflows.

## Code Quality and Structure

The monorepo structure promotes:
*   **Consistency**: Shared linting and formatting rules ensure a uniform codebase.
*   **Modularity**: Clear separation between frontend and backend concerns, allowing independent development and deployment of each service while maintaining a unified project context.
*   **Maintainability**: Centralized configuration and top-level scripts simplify project setup and ongoing maintenance.

## Logic Behind Decisions

The decision to use a monorepo structure is driven by the desire to manage related but distinct services (frontend and backend) within a single repository. This approach simplifies dependency management, facilitates code sharing (though minimal in this specific structure), and streamlines CI/CD pipelines. Project-wide configuration files ensure that coding standards and build processes are consistently applied across both applications.

**Note on "Logic Behind Decisions"**: The explanations regarding decision logic primarily reflect discussions from the current chat session and general software engineering best practices. This document does not have access to the full history of all previous, unlogged interactions or design discussions that may have influenced the project's evolution.