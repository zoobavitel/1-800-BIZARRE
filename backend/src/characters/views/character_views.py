from django.shortcuts import render
from django.http import JsonResponse
from rest_framework import viewsets, status, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from django.db import transaction
from django.core.exceptions import PermissionDenied
import json

from ..models import Character
from ..serializers import CharacterSerializer


class CharacterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CharacterSerializer
    queryset = Character.objects.all()
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        # Filter characters based on user permissions
        user = self.request.user
        if user.is_staff:
            return Character.objects.all()
        return Character.objects.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='creation-guide', permission_classes=[permissions.AllowAny])
    def creation_guide(self, request):
        """Get character creation guide and available options."""
        guide = {
            "heritages": [
                {"id": 1, "name": "Stand User", "description": "A person with a Stand ability"},
                {"id": 2, "name": "Hamon User", "description": "A person who can use Hamon energy"},
                {"id": 3, "name": "Spin User", "description": "A person who can use the Spin technique"},
            ],
            "vices": [
                {"id": 1, "name": "Faith", "description": "Religious devotion and spiritual practices"},
                {"id": 2, "name": "Gambling", "description": "Risk-taking and games of chance"},
                {"id": 3, "name": "Luxury", "description": "Indulgence in fine things and comforts"},
                {"id": 4, "name": "Obligation", "description": "Duty and responsibility to others"},
                {"id": 5, "name": "Pleasure", "description": "Physical and emotional gratification"},
                {"id": 6, "name": "Stupor", "description": "Escapism through substances or activities"},
                {"id": 7, "name": "Weird", "description": "Unusual or bizarre interests and activities"},
            ],
            "abilities": [
                {"id": 1, "name": "Insight", "description": "Perception and understanding"},
                {"id": 2, "name": "Prowess", "description": "Physical ability and combat skill"},
                {"id": 3, "name": "Resolve", "description": "Mental fortitude and willpower"},
                {"id": 4, "name": "Study", "description": "Knowledge and learning"},
                {"id": 5, "name": "Tinker", "description": "Technical skill and craftsmanship"},
            ],
            "stand_coin_stats": [
                {"name": "Power", "description": "Physical strength and destructive capability"},
                {"name": "Speed", "description": "Movement and reaction time"},
                {"name": "Range", "description": "Distance the Stand can operate from the user"},
                {"name": "Durability", "description": "Resistance to damage and ability to endure"},
                {"name": "Precision", "description": "Accuracy and fine control"},
                {"name": "Potential", "description": "Growth and development capability"},
            ]
        }
        return Response(guide)

    @action(detail=True, methods=['patch'], url_path='update-field')
    def update_field(self, request, pk=None):
        """Update a specific field on a character."""
        character = self.get_object()
        field_name = request.data.get('field')
        value = request.data.get('value')
        
        if not field_name:
            return Response(
                {'error': 'Field name is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if field exists and is editable
        if not hasattr(character, field_name):
            return Response(
                {'error': f'Field {field_name} does not exist'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update the field
        setattr(character, field_name, value)
        character.save()
        
        return Response({'message': f'Field {field_name} updated successfully'})

    @action(detail=True, methods=['post'], url_path='roll-action')
    def roll_action(self, request, pk=None):
        """Roll dice for a character action."""
        character = self.get_object()
        action_name = request.data.get('action')
        position = request.data.get('position', 'controlled')
        effect = request.data.get('effect', 'standard')
        
        if not action_name:
            return Response(
                {'error': 'Action name is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get action rating (simplified - you'd implement actual dice rolling logic)
        action_rating = getattr(character, action_name.lower(), 0)
        
        # Simulate dice roll (replace with actual dice rolling logic)
        import random
        dice_results = [random.randint(1, 6) for _ in range(action_rating)]
        highest_result = max(dice_results) if dice_results else 0
        
        # Determine outcome based on position and effect
        outcome = self._determine_outcome(highest_result, position, effect)
        
        return Response({
            'action': action_name,
            'rating': action_rating,
            'dice': dice_results,
            'highest': highest_result,
            'position': position,
            'effect': effect,
            'outcome': outcome
        })

    def _determine_outcome(self, highest_result, position, effect):
        """Determine the outcome of a dice roll."""
        if highest_result >= 6:
            return "critical success"
        elif highest_result >= 4:
            return "success"
        elif highest_result >= 1:
            return "partial success"
        else:
            return "failure"

    @action(detail=True, methods=['post'], url_path='indulge-vice')
    def indulge_vice(self, request, pk=None):
        """Indulge in vice to recover stress."""
        character = self.get_object()
        
        # Check if character has stress to recover
        if character.stress == 0:
            return Response(
                {'error': 'No stress to recover'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Recover stress (simplified - you'd implement actual vice mechanics)
        stress_recovered = min(2, character.stress)  # Recover up to 2 stress
        character.stress -= stress_recovered
        character.save()
        
        return Response({
            'message': f'Recovered {stress_recovered} stress',
            'stress_recovered': stress_recovered,
            'current_stress': character.stress
        })

    @action(detail=True, methods=['post'], url_path='take-harm')
    def take_harm(self, request, pk=None):
        """Take harm and apply consequences."""
        character = self.get_object()
        harm_level = request.data.get('level')  # 'lesser', 'moderate', 'severe'
        harm_type = request.data.get('type', 'physical')
        description = request.data.get('description', '')
        
        if not harm_level:
            return Response(
                {'error': 'Harm level is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Apply harm (simplified - you'd implement actual harm mechanics)
        harm_mapping = {
            'lesser': 1,
            'moderate': 2,
            'severe': 3
        }
        
        harm_value = harm_mapping.get(harm_level, 1)
        
        # Update character harm (you'd need to add harm fields to your model)
        # This is a simplified example
        return Response({
            'message': f'Took {harm_level} {harm_type} harm',
            'harm_level': harm_level,
            'harm_type': harm_type,
            'description': description
        })

    @action(detail=True, methods=['post'], url_path='heal-harm')
    def heal_harm(self, request, pk=None):
        """Heal harm through recovery actions."""
        character = self.get_object()
        harm_level = request.data.get('level')
        harm_type = request.data.get('type', 'physical')
        
        if not harm_level:
            return Response(
                {'error': 'Harm level is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Heal harm (simplified - you'd implement actual healing mechanics)
        return Response({
            'message': f'Healed {harm_level} {harm_type} harm',
            'harm_level': harm_level,
            'harm_type': harm_type
        })

    @action(detail=True, methods=['post'], url_path='log-armor-expenditure')
    def log_armor_expenditure(self, request, pk=None):
        """Log armor expenditure to reduce harm."""
        character = self.get_object()
        armor_type = request.data.get('type', 'regular')  # 'regular', 'special', 'resistance'
        harm_reduced = request.data.get('harm_reduced', 1)
        
        # Log armor expenditure (simplified - you'd implement actual armor mechanics)
        return Response({
            'message': f'Used {armor_type} armor to reduce harm by {harm_reduced}',
            'armor_type': armor_type,
            'harm_reduced': harm_reduced
        })

    @action(detail=True, methods=['post'], url_path='add-xp')
    def add_xp(self, request, pk=None):
        """Add XP to a character."""
        character = self.get_object()
        amount = request.data.get('amount', 1)
        reason = request.data.get('reason', '')
        
        if amount <= 0:
            return Response(
                {'error': 'XP amount must be positive'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Add XP (simplified - you'd implement actual XP mechanics)
        character.xp += amount
        character.save()
        
        return Response({
            'message': f'Added {amount} XP',
            'xp_gained': amount,
            'total_xp': character.xp,
            'reason': reason
        })

    @action(detail=True, methods=['post'], url_path='add-progress-clock')
    def add_progress_clock(self, request, pk=None):
        """Add a progress clock to a character."""
        character = self.get_object()
        name = request.data.get('name')
        segments = request.data.get('segments', 4)
        description = request.data.get('description', '')
        
        if not name:
            return Response(
                {'error': 'Clock name is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Add progress clock (simplified - you'd implement actual clock mechanics)
        return Response({
            'message': f'Added progress clock: {name}',
            'name': name,
            'segments': segments,
            'description': description
        })

    @action(detail=True, methods=['post'], url_path='update-progress-clock')
    def update_progress_clock(self, request, pk=None):
        """Update a progress clock on a character."""
        character = self.get_object()
        clock_name = request.data.get('name')
        ticks = request.data.get('ticks', 1)
        
        if not clock_name:
            return Response(
                {'error': 'Clock name is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update progress clock (simplified - you'd implement actual clock mechanics)
        return Response({
            'message': f'Updated progress clock: {clock_name}',
            'name': clock_name,
            'ticks_added': ticks
        })

    @action(detail=False, methods=['post'], url_path='create-template')
    def create_template(self, request):
        """Create a character template for quick character creation."""
        template_data = request.data
        
        # Validate template data
        required_fields = ['name', 'heritage', 'vice']
        for field in required_fields:
            if field not in template_data:
                return Response(
                    {'error': f'Field {field} is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create template (simplified - you'd implement actual template mechanics)
        return Response({
            'message': 'Character template created successfully',
            'template': template_data
        }) 