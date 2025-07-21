# 1-800-BIZARRE: Minimum Viable Product (MVP) Definition

This document outlines the Minimum Viable Product (MVP) for the 1-800-BIZARRE platform. It is a living document intended to guide development and ensure we stay focused on validating our core hypothesis.

## 1. Core Hypothesis

*   **Problem:** Game Masters (GMs) running tabletop role-playing games (TTRPGs), specifically those based on a "Jojo's Bizarre Adventure" theme, need a dedicated digital platform to manage campaigns, characters, and game mechanics efficiently.
*   **Hypothesis:** We believe that by providing a streamlined, digital toolset for campaign and character management, we can significantly reduce the administrative overhead for GMs and enhance the gameplay experience for players.
*   **Testable Assumption:** A GM can create a new campaign, and a player can create a character and join that campaign in under 10 minutes.

## 2. Target Users & Essential Needs

*   **Primary Target User:** The Game Master (GM).
*   **Secondary Target User:** The Player.
*   **Essential Job-to-be-Done:**
    *   For the GM: Create and manage a campaign, invite players, and view their character sheets.
    *   For the Player: Create a character and associate it with a campaign.

## 3. Core Functionality (The MVP Slice)

To validate our hypothesis, the MVP will focus exclusively on the following user stories:

**GM:**
1.  As a GM, I can register for an account.
2.  As a GM, I can create a new campaign.
3.  As a GM, I can view a list of my campaigns.
4.  As a GM, I can view the characters that have joined my campaign.

**Player:**
1.  As a Player, I can register for an account.
2.  As a Player, I can create a new character.
3.  As a Player, I can view a list of my characters.
4.  As a Player, I can join an existing campaign using a unique identifier provided by the GM.

## 4. Current Status vs. MVP Requirements

### What's Already Built:

Based on a detailed analysis of the backend Django models, a robust data structure is already in place. This provides a strong foundation for both the MVP and future features.

*   **Core Data Models:**
    *   **User & Campaign Management:** `UserProfile` and `Campaign` models are fully defined.
    *   **Character & NPC Sheets:** Comprehensive models for `Character` and `NPC` exist, including fields for stats, abilities, stress, harm, and inventory.
    *   **Crews & Factions:** `Crew` and `Faction` models are implemented, with relationships to campaigns and characters.
    *   **Gameplay Mechanics:** The backend includes models for `Session`, `Ability`, `Claim`, `CrewUpgrade`, `ProgressClock`, and `Score` (which includes a `target` field).
    *   **History & Logging:** `CharacterHistory`, `XPHistory`, and `StressHistory` models are in place to track changes over time.

*   **Backend Architecture:** The backend has been refactored to follow modern architectural principles:
    *   **Feature-Based Organization:** Views are organized by feature (character_views.py, campaign_views.py, etc.) rather than by type
    *   **Service Layer:** Business logic has been extracted into service classes (CharacterService, CampaignService) for better separation of concerns
    *   **Modular Structure:** The codebase is organized into focused, maintainable modules with clear responsibilities
    *   **API Endpoints:** Comprehensive RESTful API endpoints are in place for all core functionality

### What's Missing for MVP:

*   **Frontend:**
    *   **User Registration/Login:** A functional UI for users to create accounts and log in.
    *   **Campaign Creation Form:** A simple form for a GM to create a new campaign.
    *   **Campaign Dashboard:** A view for the GM to see their campaigns and the characters within them.
    *   **Character Creation Form:** A user-friendly interface for players to create their characters.
    *   **Character Dashboard:** A view for players to see their characters.
    *   **"Join Campaign" Functionality:** A mechanism for a player to use a code or link to join a campaign.
*   **Backend-Frontend Integration:**
    *   Connecting the frontend forms and dashboards to the existing backend API endpoints.
*   **Testing & Validation:**
    *   End-to-end testing of the complete user journey from registration to character creation
    *   Performance testing to ensure the 10-minute creation target is achievable

## 5. Measurement & Learning

*   **Key Metrics:**
    *   Number of user sign-ups (differentiating between GMs and Players if possible).
    *   Number of campaigns created.
    *   Number of characters created.
    *   Ratio of characters to campaigns.
*   **Qualitative Feedback:**
    *   Direct interviews with a small group of initial users (GMs and players) to gather feedback on the ease of use and whether the platform solves their core problem.

## 6. Roadmap Beyond MVP

If the MVP validates our core assumption, the next steps will be to expand the feature set based on user feedback. The following are potential next steps, to be prioritized based on user needs:

*   **Character Sheet Integration:** A more detailed and interactive digital character sheet.
*   **Ability/Skill Management:** Implementing the systems for managing character abilities, as hinted at by the documentation.
*   **Session Management:** Tools for GMs to plan and run sessions, including initiative tracking and note-taking.
*   **Real-time Updates:** Using technologies like WebSockets to provide real-time updates during gameplay.

## 7. Future Vision: Full-Featured GM Toolkit

The following is a comprehensive list of features for the full version of the 1-800-BIZARRE platform, representing the long-term vision for a complete GM toolkit:

### Campaign & Player Management
*   **Campaign Creation:** GMs can create and manage multiple campaigns.
*   **Player Invitations:** GMs can invite players to join their campaigns.
*   **Character Sheet Auditing:** GMs can see a log of changes made to player character sheets.
*   **Character Sheet Locking:** GMs can lock specific sections of a character sheet to prevent edits.
*   **NPC Creation & Management:** GMs can create Non-Player Characters (NPCs), assign them to Factions within a campaign, and manage their character sheets.
*   **NPC Sheet Visibility:** GMs can choose to show or hide NPC character sheets from players.

### Session & Gameplay Management
*   **Session Creation:** GMs can create and manage individual sessions within a campaign.
*   **Active Session:** GMs can set a session as "active" to indicate the current gameplay session.
*   **Progress Clocks:** GMs can create, configure, and display progress clocks to players.
*   **Position & Effect:** GMs can set and display the position and effect for player actions and rolls.
*   **Stress & Armor Tracking:** The platform will track and display stress costs and armor expenditure for players across sessions.
*   **NPC Clocks:** GMs can configure durability and vulnerability clocks for NPCs, with vulnerability clock size determined by Stand durability grade (4-12 segments).
*   **NPC Armor System:** NPCs have a dual armor system based on Stand durability:
    *   **Regular Armor:** Reduces harm by 1 level (1-5 charges based on durability grade)
    *   **Special Armor:** Completely negates harm/consequences (0-3 charges based on durability grade)

### Resource & Item Management
*   **Crew Resources:** GMs can create and manage resources for player crews, including Claims, Coin, Vaults, and Upgrades.
*   **Item Creation:** GMs can create custom items, from standard tools and weapons to unique artifacts.
*   **Armor System:** The platform will support different types of armor:
    *   **Regular Armor:** Reduces a consequence by 1.
    *   **Special Armor:** Completely negates a consequence or harm. Only given through bizarre artifacts (and some abilities)
    *   **Resistance:** If a player has resistance to a specific type of harm, they can reduce a consequence by 2 when using regular armor.

### Player-Centric Features

*   **Character Creation:** Players can create characters, choosing between Stand, Hamon, or Spin user types, and allocate abilities, dice, and Stand Coin stats appropriate for their level. The system includes comprehensive validation to ensure characters conform to game rules.
*   **Campaign & Crew:** Players can join campaigns and their associated crews.
*   **Collaborative Gameplay:** Players can vote on sessions and claims to pursue.
*   **Dice Rolling:** Players can roll dice for actions, resistance, and vice, with results visible to the GM and other players.
*   **Information Display:** Players can see their Wanted Level, the current position and effect for their actions, and stress costs.
*   **Session & XP History:** Players have access to a detailed history of sessions, including XP earned, actions taken, and stress spent.
*   **Character Advancement:** Players can spend XP to advance their characters, such as by increasing Stand Coin, adding dice to action ratings, or gaining Heritage points.
*   **Downtime Activities:** Players have a set number of actions during downtime to spend coin, fulfill their vice, work on personal projects, or engage with allies.
*   **Devil's Bargains:** Players can accept Devil's Bargains for a bonus to their roll, with consequences and benefits configurable by the GM.

## 8. Design Philosophy

*   **GM-Centric Flexibility:** The platform is designed to be a tool for the Game Master, not a rigid rules engine. Features are built to be configurable and optional, allowing GMs to use what they need and ignore what they don't.
*   **Configurable Faction System:** The `Faction` model has been intentionally designed to be highly configurable. The `faction_type` field is a simple text field, not a dropdown with predefined choices. This allows GMs to create any kind of faction they can imagine, from a "Criminal Syndicate" to an "Ancient Order of Scribes," without being limited by a preset list. The goal is to provide a flexible system that can adapt to any campaign setting.
