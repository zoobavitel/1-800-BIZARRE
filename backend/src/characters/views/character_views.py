from django.shortcuts import render
from django.http import JsonResponse
from django.db import models
from rest_framework import viewsets, status, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django.db import transaction
from django.core.exceptions import PermissionDenied
import json

import random
from ..models import Character, Session, Roll, RollHistory
from ..serializers import CharacterSerializer


class CharacterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CharacterSerializer
    queryset = Character.objects.all()
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def get_queryset(self):
        # Filter: own characters, or characters in campaigns where user is GM
        user = self.request.user
        if user.is_staff:
            return Character.objects.all()
        return Character.objects.filter(
            models.Q(user=user) | models.Q(campaign__gm=user)
        ).distinct()

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
                {"name": "Development", "description": "Growth potential and development capability"},
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
        """Roll dice for a character action. Supports position, effect, push (stress), and persists to Roll when session_id provided."""
        character = self.get_object()
        action_name = request.data.get('action')
        position = (request.data.get('position') or 'risky').lower()
        effect = (request.data.get('effect') or 'standard').lower()
        session_id = request.data.get('session_id')
        push_effect = request.data.get('push_effect', False)
        push_dice = request.data.get('push_dice', False)
        roll_type = request.data.get('roll_type', 'ACTION')

        # Normalize effect: 'great' -> 'greater'
        if effect == 'great':
            effect = 'greater'
        if position not in ('controlled', 'risky', 'desperate'):
            position = 'risky'
        if effect not in ('limited', 'standard', 'greater'):
            effect = 'standard'

        # Fortune roll: GM sets dice_pool directly; no action/incapacitated/push
        if roll_type.upper() == 'FORTUNE':
            action_name = action_name or 'Fortune'
            dice_pool = max(1, min(6, int(request.data.get('dice_pool', 2))))
            stress_cost = 0
            action_rating = 0
            attribute_dice = 0
        else:
            if not action_name:
                return Response({'error': 'Action name is required'}, status=status.HTTP_400_BAD_REQUEST)

            # Incapacitated (level 3 harm): must push to act
            incapacitated = getattr(character, 'harm_level3_used', False)
            if incapacitated and not (push_effect or push_dice):
                return Response(
                    {'error': 'Incapacitated (level 3 harm). You must push yourself to take an action (2 stress for +1 effect or +1d).'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Push costs 2 stress each
            stress_cost = 0
            if push_effect:
                stress_cost += 2
            if push_dice:
                stress_cost += 2
            current_stress = getattr(character, 'stress', 0) or 0
            if stress_cost > current_stress:
                return Response(
                    {'error': f'Not enough stress. Push costs {stress_cost} stress, you have {current_stress}.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Apply push: +1 effect tier
            effect_order = ['limited', 'standard', 'greater']
            if push_effect and effect in effect_order:
                idx = effect_order.index(effect)
                if idx < len(effect_order) - 1:
                    effect = effect_order[idx + 1]

        # Get action rating from action_dots (flat or nested) - skip for FORTUNE
        if roll_type.upper() != 'FORTUNE':
            action_dots = character.action_dots or {}
            action_rating = 0
            if isinstance(action_dots.get('insight'), dict):
                for group in action_dots.values():
                    if isinstance(group, dict) and action_name.lower() in group:
                        action_rating = group.get(action_name.lower(), 0) or 0
                        break
            else:
                action_rating = action_dots.get(action_name.lower(), 0) or 0

            # Attribute dice: each action in same attribute with dots > 0 adds 1
            insight_actions = ['hunt', 'study', 'survey', 'tinker']
            prowess_actions = ['finesse', 'prowl', 'skirmish', 'wreck']
            resolve_actions = ['bizarre', 'command', 'consort', 'sway']

            def get_dots(action):
                if isinstance(action_dots.get('insight'), dict):
                    for group in action_dots.values():
                        if isinstance(group, dict) and action in group:
                            return group.get(action, 0) or 0
                return action_dots.get(action, 0) or 0

            attr_group = (insight_actions if action_name.lower() in insight_actions else
                          prowess_actions if action_name.lower() in prowess_actions else resolve_actions)
            attribute_dice = len([a for a in attr_group if get_dots(a) > 0])

            dice_pool = action_rating + attribute_dice
            if push_dice:
                dice_pool += 1

        dice_results = [random.randint(1, 6) for _ in range(max(1, dice_pool))] if dice_pool > 0 else [0]
        max_result = max(dice_results) if dice_results else 0

        if max_result >= 6:
            outcome = 'CRITICAL_SUCCESS'
        elif max_result >= 4:
            outcome = 'FULL_SUCCESS'
        elif max_result >= 1:
            outcome = 'PARTIAL_SUCCESS'
        else:
            outcome = 'FAILURE'

        # Deduct stress for push
        if stress_cost > 0:
            character.stress = max(0, current_stress - stress_cost)
            character.save(update_fields=['stress'])

        roll = None
        if session_id:
            try:
                session = Session.objects.get(id=session_id)
                if character.campaign_id != session.campaign_id:
                    return Response({'error': 'Session must belong to character\'s campaign.'}, status=status.HTTP_400_BAD_REQUEST)
                roll = Roll.objects.create(
                    character=character,
                    session=session,
                    roll_type=roll_type,
                    action_name=action_name,
                    position=position,
                    effect=effect,
                    dice_pool=dice_pool,
                    results=dice_results,
                    outcome=outcome,
                    description=f"{action_name} roll"
                )
                RollHistory.objects.create(campaign=session.campaign, roll=roll)
            except Session.DoesNotExist:
                pass

        return Response({
            'action': action_name,
            'rating': action_rating,
            'attribute_dice': attribute_dice,
            'total_dice': dice_pool,
            'dice_results': dice_results,
            'highest': max_result,
            'position': position,
            'effect': effect,
            'outcome': outcome.lower().replace('_', ' '),
            'roll_id': roll.id if roll else None,
            'stress_spent': stress_cost,
        })

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