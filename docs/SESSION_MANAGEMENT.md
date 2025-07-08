# Session and Faction Management

This document outlines the backend features for managing game sessions and factions within a campaign.

## Faction Management

To provide a more structured way to manage factions, the simple `factions` JSON field on the `Campaign` model has been replaced by a dedicated `Faction` model.

### The `Faction` Model

The `Faction` model holds all the information about a specific faction within a campaign.

**Fields:**

*   `name` (CharField): The name of the faction.
*   `campaign` (ForeignKey to `Campaign`): The campaign this faction belongs to.
*   `faction_type` (CharField): The type of faction. Choices are:
    *   'CRIMINAL'
    *   'NOBLE'
    *   'MERCHANT'
    *   'POLITICAL'
    *   'RELIGIOUS'
    *   'OTHER'
*   `notes` (TextField): A place for the GM to keep notes about the faction.
*   `hold` (CharField): The faction's current hold. Choices are 'weak' or 'strong'.
*   `reputation` (IntegerField): The crew's reputation with this faction.

### `ProgressClock` Integration

The `ProgressClock` model now has a `faction` field (a ForeignKey to `Faction`). This allows you to create progress clocks for specific faction objectives.

## Session Management

The session management system has been significantly enhanced to allow GMs to plan and run their games more effectively.

### The `Session` Model

The `Session` model has been updated with new fields to support planning and tracking.

**New Fields:**

*   `status` (CharField): The current status of the session. Choices are:
    *   `PLANNED`: The session is planned but not yet active.
    *   `ACTIVE`: The session is currently being played.
    *   `COMPLETED`: The session has been completed.
*   `objective` (TextField): The main goal or objective for the session.
*   `planned_for_next_session` (TextField): A place for the GM to write notes for the next session.

### The `Campaign` Model

The `Campaign` model now has a field to track the active session.

**New Field:**

*   `active_session` (ForeignKey to `Session`): A link to the currently active session in the campaign. This allows the GM to easily toggle which session is "live."

### The `SessionEvent` Model

To provide a detailed play-by-play log of each session, the `log` JSON field on the `Session` model has been replaced by a dedicated `SessionEvent` model.

**Fields:**

*   `session` (ForeignKey to `Session`): The session this event belongs to.
*   `character` (ForeignKey to `Character`): The character associated with this event (if any).
*   `npc` (ForeignKey to `NPC`): The NPC associated with this event (if any).
*   `event_type` (CharField): The type of event. Choices are:
    *   `DICE_ROLL`
    *   `STRESS_CHANGE`
    *   `HARM_APPLIED`
    *   `ITEM_ACQUIRED`
    *   `DEVILS_BARGAIN`
    *   `LOCATION_CHANGE`
    *   `OTHER`
*   `details` (JSONField): A flexible field to store the specific details of the event. For example, for a `DICE_ROLL` event, you could store:

    ```json
    {
        "position": "controlled",
        "effect": "great",
        "result": 6
    }
    ```
*   `timestamp` (DateTimeField): The time the event occurred.
