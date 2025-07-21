# Characters Services Module

This directory contains the business logic layer for the characters app, separated from the views to maintain clean architecture and separation of concerns.

## Structure

```
services/
├── __init__.py              # Package initialization
├── character_service.py     # Character business logic
├── campaign_service.py      # Campaign business logic
└── README.md               # This file
```

## Purpose

The services layer contains all business logic that was previously embedded in views. This separation provides:

1. **Clean Architecture**: Views handle HTTP, services handle business logic
2. **Reusability**: Business logic can be used across multiple views
3. **Testability**: Services can be unit tested independently
4. **Maintainability**: Logic is centralized and easier to modify

## Service Classes

### CharacterService

Handles all character-related business logic:

- **Dice Rolling**: `roll_action_dice()`, `determine_outcome()`
- **Character Actions**: `indulge_vice()`, `take_harm()`, `heal_harm()`
- **Character Management**: `add_xp()`, `update_field()`, `create_character_template()`
- **Permissions**: `can_edit_character()`, `get_user_characters()`

### CampaignService

Handles all campaign-related business logic:

- **Campaign Management**: `create_campaign()`, `update_campaign()`, `delete_campaign()`
- **Character Management**: `add_character_to_campaign()`, `remove_character_from_campaign()`
- **Data Retrieval**: `get_user_campaigns()`, `get_campaign_characters()`, `get_campaign_npcs()`
- **Permissions**: `can_edit_campaign()`

## Usage Examples

### In Views

```python
from ..services.character_service import CharacterService
from ..services.campaign_service import CampaignService

class CharacterViewSet(viewsets.ModelViewSet):
    def roll_action(self, request, pk=None):
        character = self.get_object()
        
        # Use service for business logic
        dice_results, highest = CharacterService.roll_action_dice(
            character.action_rating
        )
        outcome = CharacterService.determine_outcome(highest)
        
        return Response({
            'dice': dice_results,
            'highest': highest,
            'outcome': outcome
        })
    
    def indulge_vice(self, request, pk=None):
        character = self.get_object()
        
        try:
            # Use service for business logic
            stress_recovered = CharacterService.indulge_vice(character)
            return Response({
                'stress_recovered': stress_recovered,
                'current_stress': character.stress
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
```

### In Tests

```python
from ..services.character_service import CharacterService

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

## Design Principles

### 1. Static Methods
All service methods are static to avoid state management and make them easy to use:

```python
# Good
stress_recovered = CharacterService.indulge_vice(character)

# Avoid
service = CharacterService()
stress_recovered = service.indulge_vice(character)
```

### 2. Clear Error Handling
Services raise appropriate exceptions that views can catch:

```python
def indulge_vice(character):
    if character.stress == 0:
        raise ValueError("No stress to recover")
    # ... rest of logic
```

### 3. Single Responsibility
Each service class handles one domain:

- `CharacterService` - Character logic only
- `CampaignService` - Campaign logic only

### 4. Database Operations
Services handle database operations and transactions:

```python
@staticmethod
def add_xp(character, amount, reason=''):
    character.xp += amount
    character.save()
    
    # Log the change
    CharacterHistory.objects.create(
        character=character,
        action='xp_gained',
        details=f'Gained {amount} XP: {reason}',
        value=amount
    )
```

## Future Services

As the application grows, consider adding these services:

- **SessionService**: Session management and gameplay logic
- **CrewService**: Crew mechanics and consensus
- **NPCService**: NPC management and AI logic
- **AbilityService**: Ability management and effects
- **DiceService**: Advanced dice rolling and probability
- **NotificationService**: Event notifications and messaging

## Benefits

1. **Separation of Concerns**: Views handle HTTP, services handle business logic
2. **Reusability**: Services can be used across multiple views
3. **Testability**: Services can be unit tested independently
4. **Maintainability**: Logic is centralized and easier to modify
5. **Scalability**: Easy to add new services as the application grows 