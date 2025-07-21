# Backend Refactoring: Modular Architecture

This document outlines the refactoring of the backend to follow modern organization principles, similar to those recommended for React applications.

## Overview

The original `views.py` file was a monolithic 1905-line file containing all view classes mixed together. This has been refactored into a modular, feature-based architecture that follows clean code principles.

## Before vs After

### Before: Monolithic Structure
```
characters/
├── views.py (1905 lines) - All views mixed together
├── models.py
├── serializers.py
└── ...
```

### After: Modular Structure
```
characters/
├── views/
│   ├── __init__.py              # Backward compatibility imports
│   ├── character_views.py       # Character-related views
│   ├── campaign_views.py        # Campaign-related views
│   ├── npc_views.py            # NPC-related views
│   ├── crew_views.py           # Crew-related views
│   ├── session_views.py        # Session-related views
│   ├── auth_views.py           # Authentication views
│   ├── gameplay_views.py       # Gameplay mechanics views
│   ├── reference_views.py      # Reference data views
│   ├── utility_views.py        # Utility views
│   └── README.md               # Documentation
├── services/
│   ├── __init__.py
│   ├── character_service.py    # Character business logic
│   ├── campaign_service.py     # Campaign business logic
│   └── README.md               # Documentation
├── models.py
├── serializers.py
└── ...
```

## Organization Principles Applied

### 1. ✅ Group by Feature, Not by Type
Instead of organizing by file type (all models, all views, all services), we organize by feature/domain:

- **Character Domain**: `character_views.py` + `character_service.py`
- **Campaign Domain**: `campaign_views.py` + `campaign_service.py`
- **Authentication Domain**: `auth_views.py`
- **Session Domain**: `session_views.py`

### 2. ✅ Keep Controllers Focused and Modular
Views remain small and delegate business logic to services:

```python
# Before: Business logic in views
class CharacterViewSet(viewsets.ModelViewSet):
    def roll_action(self, request, pk=None):
        character = self.get_object()
        # 50+ lines of dice rolling logic here
        dice_results = [random.randint(1, 6) for _ in range(action_rating)]
        # ... more logic

# After: Views delegate to services
class CharacterViewSet(viewsets.ModelViewSet):
    def roll_action(self, request, pk=None):
        character = self.get_object()
        dice_results, highest = CharacterService.roll_action_dice(
            character.action_rating
        )
        outcome = CharacterService.determine_outcome(highest)
        return Response({'dice': dice_results, 'outcome': outcome})
```

### 3. ✅ Avoid Deep Nesting
The structure is flat and easy to navigate:

```
views/
├── character_views.py    # All character views
├── campaign_views.py     # All campaign views
└── auth_views.py         # All auth views
```

Instead of:
```
views/
├── models/
├── controllers/
└── services/
```

### 4. ✅ Name Clearly and Consistently
Files use descriptive names with clear suffixes:

- `character_views.py` - Character-related views
- `character_service.py` - Character business logic
- `campaign_views.py` - Campaign-related views
- `campaign_service.py` - Campaign business logic

### 5. ✅ Mirror Frontend Domain Language
The structure mirrors the frontend organization:

- Frontend: `/characters`, `/campaigns`, `/crews`
- Backend: `character_views.py`, `campaign_views.py`, `crew_views.py`

## Services Layer

### Purpose
The services layer separates business logic from HTTP handling:

```python
# CharacterService handles all character business logic
class CharacterService:
    @staticmethod
    def roll_action_dice(action_rating, num_dice=None):
        """Roll dice for a character action."""
        if num_dice is None:
            num_dice = action_rating
        
        if num_dice <= 0:
            return [], 0
        
        dice_results = [random.randint(1, 6) for _ in range(num_dice)]
        highest_result = max(dice_results)
        
        return dice_results, highest_result
    
    @staticmethod
    def indulge_vice(character):
        """Indulge in vice to recover stress."""
        if character.stress == 0:
            raise ValueError("No stress to recover")
        
        stress_recovered = min(2, character.stress)
        character.stress -= stress_recovered
        character.save()
        
        return stress_recovered
```

### Benefits
1. **Reusability**: Business logic can be reused across different views
2. **Testability**: Services can be unit tested independently
3. **Maintainability**: Logic is centralized and easier to modify
4. **Separation of Concerns**: Views focus on HTTP, services focus on business logic

## File Breakdown

### Views Directory

| File | Purpose | Lines | ViewSets/Views |
|------|---------|-------|----------------|
| `character_views.py` | Character management | ~300 | CharacterViewSet |
| `campaign_views.py` | Campaign management | ~50 | CampaignViewSet |
| `npc_views.py` | NPC management | ~30 | NPCViewSet |
| `crew_views.py` | Crew mechanics | ~80 | CrewViewSet |
| `session_views.py` | Session management | ~120 | SessionViewSet, SessionEventViewSet |
| `auth_views.py` | Authentication | ~100 | RegisterView, LoginView, UserProfileViewSet |
| `gameplay_views.py` | Gameplay mechanics | ~50 | ClaimViewSet, Crew abilities, etc. |
| `reference_views.py` | Reference data | ~80 | HeritageViewSet, ViceViewSet, etc. |
| `utility_views.py` | Utility functions | ~200 | Search, documentation, etc. |

### Services Directory

| File | Purpose | Methods |
|------|---------|---------|
| `character_service.py` | Character business logic | 10+ methods |
| `campaign_service.py` | Campaign business logic | 8+ methods |

## Migration Strategy

### Backward Compatibility
The `__init__.py` file maintains backward compatibility:

```python
# Import all view classes for backward compatibility
from .character_views import CharacterViewSet
from .campaign_views import CampaignViewSet
# ... etc

__all__ = [
    'CharacterViewSet', 'CampaignViewSet', 'NPCViewSet',
    # ... all view classes
]
```

This means existing imports continue to work:

```python
# Still works after refactoring
from .views import CharacterViewSet, CampaignViewSet
```

### Gradual Migration
Views can be gradually updated to use services:

```python
# Step 1: Keep existing view logic
class CharacterViewSet(viewsets.ModelViewSet):
    def roll_action(self, request, pk=None):
        # Existing logic remains
        pass

# Step 2: Refactor to use services
class CharacterViewSet(viewsets.ModelViewSet):
    def roll_action(self, request, pk=None):
        # New logic using services
        dice_results, highest = CharacterService.roll_action_dice(
            character.action_rating
        )
```

## Testing Strategy

### Service Testing
Services can be unit tested independently:

```python
class CharacterServiceTest(TestCase):
    def test_roll_action_dice(self):
        dice_results, highest = CharacterService.roll_action_dice(3)
        
        self.assertEqual(len(dice_results), 3)
        self.assertTrue(all(1 <= die <= 6 for die in dice_results))
        self.assertEqual(highest, max(dice_results))
    
    def test_indulge_vice_no_stress(self):
        character = Character.objects.create(stress=0)
        
        with self.assertRaises(ValueError):
            CharacterService.indulge_vice(character)
```

### View Testing
Views can be tested with mocked services:

```python
@patch('characters.views.character_views.CharacterService')
class CharacterViewSetTest(TestCase):
    def test_roll_action(self, mock_service):
        mock_service.roll_action_dice.return_value = ([4, 5, 6], 6)
        mock_service.determine_outcome.return_value = "success"
        
        # Test view with mocked service
        response = self.client.post('/api/characters/1/roll-action/')
        self.assertEqual(response.status_code, 200)
```

## Benefits Achieved

### 1. Maintainability
- **Before**: 1905-line monolithic file
- **After**: 8 focused files, each under 300 lines
- **Result**: Easier to find and modify specific functionality

### 2. Testability
- **Before**: Business logic embedded in views, hard to test
- **After**: Services can be unit tested independently
- **Result**: Better test coverage and faster tests

### 3. Reusability
- **Before**: Logic duplicated across views
- **After**: Services can be reused across multiple views
- **Result**: DRY principle, less code duplication

### 4. Readability
- **Before**: All functionality mixed together
- **After**: Clear separation by domain
- **Result**: Easier to understand and navigate

### 5. Scalability
- **Before**: Adding features required modifying large file
- **After**: Add new files for new domains
- **Result**: Easier to scale and add new features

## Future Enhancements

### 1. Additional Services
- `SessionService` - Session management and gameplay logic
- `CrewService` - Crew mechanics and consensus
- `NPCService` - NPC management and AI logic
- `AbilityService` - Ability management and effects
- `DiceService` - Advanced dice rolling and probability

### 2. Middleware
- Custom middleware for common functionality
- Authentication middleware
- Logging middleware
- Error handling middleware

### 3. Utilities
- Shared utility functions
- Common decorators
- Validation utilities
- Serialization helpers

### 4. Configuration
- Environment-specific settings
- Feature flags
- Configuration management

## Conclusion

This refactoring transforms the backend from a monolithic structure to a modular, maintainable architecture that follows modern software engineering principles. The separation of concerns, clear organization, and service layer make the codebase easier to understand, test, and maintain.

The structure now mirrors the frontend organization and provides a solid foundation for future development while maintaining backward compatibility with existing code. 