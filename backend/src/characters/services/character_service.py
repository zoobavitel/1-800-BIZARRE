import random
from django.db import transaction
from django.core.exceptions import PermissionDenied
from ..models import Character, CharacterHistory


class CharacterService:
    """Service class for character-related business logic."""
    
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
    def determine_outcome(highest_result, position='controlled', effect='standard'):
        """Determine the outcome of a dice roll based on position and effect."""
        if highest_result >= 6:
            return "critical success"
        elif highest_result >= 4:
            return "success"
        elif highest_result >= 1:
            return "partial success"
        else:
            return "failure"
    
    @staticmethod
    def indulge_vice(character):
        """Indulge in vice to recover stress."""
        if character.stress == 0:
            raise ValueError("No stress to recover")
        
        # Recover up to 2 stress
        stress_recovered = min(2, character.stress)
        character.stress -= stress_recovered
        character.save()
        
        return stress_recovered
    
    @staticmethod
    def take_harm(character, harm_level, harm_type='physical', description=''):
        """Apply harm to a character."""
        harm_mapping = {
            'lesser': 1,
            'moderate': 2,
            'severe': 3
        }
        
        harm_value = harm_mapping.get(harm_level, 1)
        
        # Apply harm (you'd implement actual harm mechanics here)
        # This is a simplified example
        return {
            'harm_level': harm_level,
            'harm_type': harm_type,
            'harm_value': harm_value,
            'description': description
        }
    
    @staticmethod
    def heal_harm(character, harm_level, harm_type='physical'):
        """Heal harm from a character."""
        # Implement actual healing mechanics here
        return {
            'harm_level': harm_level,
            'harm_type': harm_type
        }
    
    @staticmethod
    def add_xp(character, amount, reason=''):
        """Add XP to a character."""
        if amount <= 0:
            raise ValueError("XP amount must be positive")
        
        character.xp += amount
        character.save()
        
        # Log XP gain
        CharacterHistory.objects.create(
            character=character,
            action='xp_gained',
            details=f'Gained {amount} XP: {reason}',
            value=amount
        )
        
        return amount
    
    @staticmethod
    def update_field(character, field_name, value):
        """Update a specific field on a character."""
        if not hasattr(character, field_name):
            raise ValueError(f'Field {field_name} does not exist')
        
        old_value = getattr(character, field_name)
        setattr(character, field_name, value)
        character.save()
        
        # Log the change
        CharacterHistory.objects.create(
            character=character,
            action='field_updated',
            details=f'Updated {field_name}: {old_value} → {value}',
            value=value
        )
        
        return True
    
    @staticmethod
    def create_character_template(template_data):
        """Create a character template for quick character creation."""
        required_fields = ['name', 'heritage', 'vice']
        for field in required_fields:
            if field not in template_data:
                raise ValueError(f'Field {field} is required')
        
        # Validate template data (you'd implement actual validation here)
        return template_data
    
    @staticmethod
    def can_edit_character(user, character):
        """Check if a user can edit a character."""
        return user == character.user or user.is_staff
    
    @staticmethod
    def get_user_characters(user):
        """Get all characters for a user."""
        if user.is_staff:
            return Character.objects.all()
        return Character.objects.filter(user=user) 