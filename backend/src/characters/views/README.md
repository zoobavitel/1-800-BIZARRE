# Characters Views Module

This directory contains the modularized views for the characters app, organized by feature/domain rather than by type.

## Structure

```
views/
├── __init__.py              # Imports all view classes for backward compatibility
├── character_views.py       # Character-related views (CharacterViewSet)
├── campaign_views.py        # Campaign-related views (CampaignViewSet)
├── npc_views.py            # NPC-related views (NPCViewSet)
├── crew_views.py           # Crew-related views (CrewViewSet)
├── session_views.py        # Session-related views (SessionViewSet, SessionEventViewSet)
├── auth_views.py           # Authentication views (RegisterView, LoginView, UserProfileViewSet)
├── gameplay_views.py       # Gameplay mechanics views (Claim, Crew abilities, etc.)
├── reference_views.py      # Reference data views (Heritage, Vice, Ability, etc.)
├── utility_views.py        # Utility views (search, documentation, etc.)
└── README.md               # This file
```

## Organization Principles

### 1. Group by Feature, Not by Type
Each file contains views related to a specific domain/feature:
- `character_views.py` - All character-related functionality
- `campaign_views.py` - Campaign management
- `auth_views.py` - User authentication and profiles
- etc.

### 2. Keep Controllers Focused and Modular
Views remain small and delegate business logic to services:
- Views handle HTTP requests/responses
- Business logic is in the `services/` directory
- Clear separation of concerns

### 3. Avoid Deep Nesting
The structure is flat and easy to navigate:
- No `/models`, `/services`, `/controllers` subdirectories
- Each feature has its own file
- Easy to find specific functionality

### 4. Clear Naming
Files use descriptive names with `.py` suffix:
- `character_views.py` - Character-related views
- `campaign_views.py` - Campaign-related views
- `auth_views.py` - Authentication views

### 5. Mirror Frontend Domain Language
The structure mirrors the frontend organization:
- `/characters` - Character management
- `/campaigns` - Campaign management
- `/crews` - Crew mechanics
- `/sessions` - Session management

## Services Layer

Business logic is separated into the `services/` directory:

```
services/
├── __init__.py
├── character_service.py    # Character business logic
├── campaign_service.py     # Campaign business logic
└── README.md
```

### Benefits of Services Layer

1. **Reusability**: Business logic can be reused across different views
2. **Testability**: Services can be unit tested independently
3. **Maintainability**: Logic is centralized and easier to modify
4. **Separation of Concerns**: Views focus on HTTP, services focus on business logic

## Usage

### Importing Views
All views are imported through the `__init__.py` file for backward compatibility:

```python
from .views import CharacterViewSet, CampaignViewSet
```

### Using Services
Services are used within views to handle business logic:

```python
from ..services.character_service import CharacterService

class CharacterViewSet(viewsets.ModelViewSet):
    def roll_action(self, request, pk=None):
        character = self.get_object()
        dice_results, highest = CharacterService.roll_action_dice(
            character.action_rating
        )
        # ... rest of view logic
```

## Migration from Monolithic Structure

The original `views.py` file (1905 lines) has been broken down into focused modules:

- **Before**: One large file with all views mixed together
- **After**: 8 focused files, each handling a specific domain

This makes the codebase:
- **Easier to navigate**: Find specific functionality quickly
- **Easier to maintain**: Changes are isolated to specific domains
- **Easier to test**: Each module can be tested independently
- **Easier to understand**: Clear separation of concerns

## Future Enhancements

1. **Add more services**: Create services for other domains (sessions, crews, etc.)
2. **Add middleware**: Custom middleware for common functionality
3. **Add utilities**: Shared utility functions
4. **Add validators**: Custom validation logic
5. **Add decorators**: Custom decorators for common patterns 