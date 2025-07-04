from django.shortcuts import render
from django.http import JsonResponse
from django.db import models
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import RegisterSerializer
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from django.contrib.auth import authenticate
from rest_framework.permissions import AllowAny
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes, action
import json
from django.db import transaction

from .models import (
    Heritage, Vice, Ability, Character, Stand,
    Campaign, NPC, Crew, StandAbility, HamonAbility, SpinAbility, Trauma, Benefit, Detriment
)
from .serializers import (
    HeritageSerializer, ViceSerializer, AbilitySerializer,
    CharacterSerializer, StandSerializer,
    CampaignSerializer, NPCSerializer, CrewSerializer, StandAbilitySerializer,
    HamonAbilitySerializer, SpinAbilitySerializer, TraumaSerializer
)

# Optional root view
def home(request):
    return JsonResponse({"message": "Welcome to the 1(800)Bizarre API!"})

class RegisterView(APIView):
    permission_classes = [AllowAny]  # <-- ADD THIS LINE

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, created = Token.objects.get_or_create(user=user)
            return Response({'token': token.key}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# === ViewSets ===

class HeritageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Heritage.objects.all()
    serializer_class = HeritageSerializer


class ViceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Vice.objects.all()
    serializer_class = ViceSerializer


class AbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Ability.objects.all()
    serializer_class = AbilitySerializer

class StandViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Stand.objects.all()
    serializer_class = StandSerializer

class StandAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = StandAbility.objects.all()
    serializer_class = StandAbilitySerializer

class HamonAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = HamonAbility.objects.all()
    serializer_class = HamonAbilitySerializer

class SpinAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = SpinAbility.objects.all()
    serializer_class = SpinAbilitySerializer

class TraumaViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only endpoint for trauma conditions."""
    permission_classes = [IsAuthenticated]
    queryset = Trauma.objects.all()
    serializer_class = TraumaSerializer

class CharacterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CharacterSerializer
    queryset = Character.objects.all()

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Character.objects.all()
        elif Campaign.objects.filter(gm=user).exists():
            return Character.objects.filter(campaign__gm=user)
        return Character.objects.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='creation-guide', permission_classes=[AllowAny])
    def creation_guide(self, request):
        """
        Get the character creation guide with all available options and rules.
        """
        from .models import Heritage, Ability, HamonAbility, SpinAbility, Vice
        
        # Get all available options for character creation
        heritages = Heritage.objects.prefetch_related('benefits', 'detriments').all()
        standard_abilities = Ability.objects.filter(type='standard')
        hamon_abilities = HamonAbility.objects.all()
        spin_abilities = SpinAbility.objects.all()
        vices = Vice.objects.all()
        
        # Character creation rules
        creation_rules = {
            'action_dots': {
                'total_available': 7,
                'max_per_action': 2,
                'description': 'Distribute 7 action dots across all actions, maximum 2 per action'
            },
            'heritage': {
                'required': True,
                'description': 'Choose a heritage to determine base HP and available benefits/detriments'
            },
            'benefits_detriments': {
                'hp_budget': 'Base HP + Detriment HP must cover Benefit costs',
                'required_selection': 'Must select all required benefits/detriments for chosen heritage'
            },
            'playbook_abilities': {
                'stand': 'Choose from standard abilities and stand-specific abilities',
                'hamon': 'Choose from Hamon abilities based on coin stat grades',
                'spin': 'Choose from Spin abilities based on coin stat grades'
            },
            'coin_stats': {
                'total_points': 10,
                'grades': ['F', 'D', 'C', 'B', 'A', 'S'],
                'description': 'Distribute 10 points across Power, Speed, Range, Durability, Precision, Development'
            }
        }
        
        return Response({
            'creation_rules': creation_rules,
            'available_options': {
                'heritages': HeritageSerializer(heritages, many=True).data,
                'standard_abilities': AbilitySerializer(standard_abilities, many=True).data,
                'hamon_abilities': HamonAbilitySerializer(hamon_abilities, many=True).data,
                'spin_abilities': SpinAbilitySerializer(spin_abilities, many=True).data,
                'vices': ViceSerializer(vices, many=True).data,
            }
        })

    @action(detail=True, methods=['patch'], url_path='update-field')
    def update_field(self, request, pk=None):
        """
        Update a single field on a character with immediate validation and saving.
        Perfect for real-time character sheet editing.
        """
        try:
            character = self.get_object()
        except Character.DoesNotExist:
            return Response({'error': 'Character not found'}, status=status.HTTP_404_NOT_FOUND)
        
        field_name = request.data.get('field')
        field_value = request.data.get('value')
        
        if not field_name:
            return Response({'error': 'Field name is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate field exists and is editable
        editable_fields = [
            'true_name', 'alias', 'appearance', 'heritage', 'vice', 'vice_details',
            'action_dots', 'coin_stats', 'stress', 'trauma', 'loadout',
            'background_note', 'background_note2', 'close_friend', 'rival',
            'stand_name', 'stand_form', 'stand_conscious', 'armor_type',
            'light_armor_used', 'medium_armor_used', 'heavy_armor_used',
            'harm_level1_used', 'harm_level1_name', 'harm_level2_used', 'harm_level2_name',
            'harm_level3_used', 'harm_level3_name', 'harm_level4_used', 'harm_level4_name',
            'healing_clock_filled', 'xp_clocks', 'custom_ability_description',
            'custom_ability_type', 'extra_custom_abilities', 'faction_reputation',
            'selected_benefits', 'selected_detriments', 'standard_abilities',
            'hamon_ability_ids', 'spin_ability_ids'
        ]
        
        if field_name not in editable_fields:
            return Response({
                'error': f'Field "{field_name}" is not editable',
                'editable_fields': editable_fields
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create update data
        update_data = {field_name: field_value}
        
        # Special handling for related fields
        if field_name in ['selected_benefits', 'selected_detriments', 'standard_abilities']:
            # These are many-to-many fields that need special handling
            if not isinstance(field_value, list):
                return Response({
                    'error': f'Field "{field_name}" requires a list of IDs'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update character
        serializer = CharacterSerializer(character, data=update_data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'field': field_name,
                'value': field_value,
                'message': f'{field_name} updated successfully'
            })
        else:
            return Response({
                'error': 'Validation failed',
                'field': field_name,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='roll-action')
    def roll_action(self, request, pk=None):
        """
        Roll dice for an action and return the result.
        """
        try:
            character = self.get_object()
        except Character.DoesNotExist:
            return Response({'error': 'Character not found'}, status=status.HTTP_404_NOT_FOUND)
        
        action_name = request.data.get('action')
        position = request.data.get('position', 'controlled')  # controlled, risky, desperate
        effect = request.data.get('effect', 'standard')  # limited, standard, great
        
        if not action_name:
            return Response({'error': 'Action name is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get action rating
        action_dots = character.action_dots or {}
        action_rating = 0
        
        for group in action_dots.values():
            if action_name.lower() in group:
                action_rating = group[action_name.lower()]
                break
        
        # Calculate dice pool
        dice_pool = action_rating
        
        # Add attribute dice (each action with at least 1 die contributes 1 to the attribute)
        attribute_actions = []
        for group_name, actions in action_dots.items():
            for action, dots in actions.items():
                if dots > 0:
                    attribute_actions.append(action)
        
        # Determine which attribute this action belongs to
        insight_actions = ['hunt', 'study', 'survey', 'tinker']
        prowess_actions = ['finesse', 'prowl', 'skirmish', 'wreck']
        resolve_actions = ['bizarre', 'command', 'consort', 'sway']
        
        if action_name.lower() in insight_actions:
            attribute_dice = len([a for a in insight_actions if any(a in group.values() for group in action_dots.values())])
        elif action_name.lower() in prowess_actions:
            attribute_dice = len([a for a in prowess_actions if any(a in group.values() for group in action_dots.values())])
        elif action_name.lower() in resolve_actions:
            attribute_dice = len([a for a in resolve_actions if any(a in group.values() for group in action_dots.values())])
        else:
            attribute_dice = 0
        
        dice_pool += attribute_dice
        
        # Simulate dice roll (in a real implementation, you might want to use a proper dice rolling library)
        import random
        dice_results = [random.randint(1, 6) for _ in range(dice_pool)] if dice_pool > 0 else [0]
        
        # Determine outcome
        max_result = max(dice_results) if dice_results else 0
        
        if max_result == 6:
            outcome = 'critical_success'
        elif max_result >= 4:
            outcome = 'success'
        elif max_result >= 1:
            outcome = 'partial_success'
        else:
            outcome = 'failure'
        
        # Position and effect modifiers
        position_modifiers = {
            'controlled': {'description': 'Safe, minimal risk'},
            'risky': {'description': 'Dangerous, significant risk'},
            'desperate': {'description': 'Extreme danger, high risk'}
        }
        
        effect_modifiers = {
            'limited': {'description': 'Minimal effect'},
            'standard': {'description': 'Normal effect'},
            'great': {'description': 'Powerful effect'}
        }
        
        return Response({
            'action': action_name,
            'action_rating': action_rating,
            'attribute_dice': attribute_dice,
            'total_dice': dice_pool,
            'dice_results': dice_results,
            'max_result': max_result,
            'outcome': outcome,
            'position': position,
            'position_info': position_modifiers.get(position, {}),
            'effect': effect,
            'effect_info': effect_modifiers.get(effect, {}),
            'character_id': character.id
        })

    @action(detail=True, methods=['post'], url_path='indulge-vice')
    def indulge_vice(self, request, pk=None):
        """
        Indulge vice to reduce stress.
        """
        try:
            character = self.get_object()
        except Character.DoesNotExist:
            return Response({'error': 'Character not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if not character.vice:
            return Response({'error': 'Character has no vice to indulge'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Calculate stress relief (typically 2-4 stress)
        import random
        stress_relieved = random.randint(2, 4)
        
        # Update stress
        new_stress = max(0, character.stress - stress_relieved)
        
        serializer = CharacterSerializer(character, data={'stress': new_stress}, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            
            # Create downtime activity record
            from .models import DowntimeActivity
            DowntimeActivity.objects.create(
                character=character,
                activity_type='INDULGE_VICE',
                description=f'Indulged vice: {character.vice.name}',
                stress_relieved=stress_relieved
            )
            
            return Response({
                'success': True,
                'vice': character.vice.name,
                'stress_relieved': stress_relieved,
                'new_stress': new_stress,
                'message': f'Indulged {character.vice.name} and relieved {stress_relieved} stress'
            })
        else:
            return Response({
                'error': 'Failed to update stress',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='take-harm')
    def take_harm(self, request, pk=None):
        """
        Take harm and update harm tracking.
        """
        try:
            character = self.get_object()
        except Character.DoesNotExist:
            return Response({'error': 'Character not found'}, status=status.HTTP_404_NOT_FOUND)
        
        harm_level = request.data.get('level')  # 1, 2, 3, or 4
        harm_name = request.data.get('name', '')
        
        if not harm_level or harm_level not in [1, 2, 3, 4]:
            return Response({'error': 'Valid harm level (1-4) is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Update harm tracking
        harm_field_used = f'harm_level{harm_level}_used'
        harm_field_name = f'harm_level{harm_level}_name'
        
        update_data = {
            harm_field_used: True,
            harm_field_name: harm_name
        }
        
        serializer = CharacterSerializer(character, data=update_data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'harm_level': harm_level,
                'harm_name': harm_name,
                'message': f'Took level {harm_level} harm: {harm_name}'
            })
        else:
            return Response({
                'error': 'Failed to update harm',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='heal-harm')
    def heal_harm(self, request, pk=None):
        """
        Heal harm and update healing clock.
        """
        try:
            character = self.get_object()
        except Character.DoesNotExist:
            return Response({'error': 'Character not found'}, status=status.HTTP_404_NOT_FOUND)
        
        harm_level = request.data.get('level')  # 1, 2, 3, or 4
        
        if not harm_level or harm_level not in [1, 2, 3, 4]:
            return Response({'error': 'Valid harm level (1-4) is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if harm exists at this level
        harm_field_used = f'harm_level{harm_level}_used'
        if not getattr(character, harm_field_used, False):
            return Response({'error': f'No level {harm_level} harm to heal'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Update harm tracking
        harm_field_name = f'harm_level{harm_level}_name'
        update_data = {
            harm_field_used: False,
            harm_field_name: ''
        }
        
        # Update healing clock
        new_healing_clock = min(character.healing_clock_segments, character.healing_clock_filled + 1)
        update_data['healing_clock_filled'] = new_healing_clock
        
        serializer = CharacterSerializer(character, data=update_data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'harm_level': harm_level,
                'healing_clock_filled': new_healing_clock,
                'message': f'Healed level {harm_level} harm and advanced healing clock'
            })
        else:
            return Response({
                'error': 'Failed to heal harm',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='add-xp')
    def add_xp(self, request, pk=None):
        """
        Add XP to a character's tracks.
        """
        try:
            character = self.get_object()
        except Character.DoesNotExist:
            return Response({'error': 'Character not found'}, status=status.HTTP_404_NOT_FOUND)
        
        track = request.data.get('track')  # insight, prowess, resolve, heritage, playbook
        amount = request.data.get('amount', 1)
        trigger = request.data.get('trigger', '')
        description = request.data.get('description', '')
        
        if not track:
            return Response({'error': 'XP track is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        valid_tracks = ['insight', 'prowess', 'resolve', 'heritage', 'playbook']
        if track not in valid_tracks:
            return Response({
                'error': f'Invalid track. Must be one of: {valid_tracks}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get current XP tracks
        xp_clocks = character.xp_clocks or {}
        current_xp = xp_clocks.get(track, 0)
        new_xp = current_xp + amount
        
        # Validate playbook track cap
        if track == 'playbook' and new_xp > 10:
            return Response({
                'error': 'Playbook track cannot exceed 10 XP'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update XP
        xp_clocks[track] = new_xp
        update_data = {'xp_clocks': xp_clocks}
        
        serializer = CharacterSerializer(character, data=update_data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            
            # Create experience entry
            from .models import ExperienceTracker
            ExperienceTracker.objects.create(
                character=character,
                trigger=trigger,
                description=description,
                xp_gained=amount
            )
            
            return Response({
                'success': True,
                'track': track,
                'amount': amount,
                'new_total': new_xp,
                'message': f'Added {amount} XP to {track} track'
            })
        else:
            return Response({
                'error': 'Failed to add XP',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='add-progress-clock')
    def add_progress_clock(self, request, pk=None):
        """
        Add a progress clock to a character.
        """
        try:
            character = self.get_object()
        except Character.DoesNotExist:
            return Response({'error': 'Character not found'}, status=status.HTTP_404_NOT_FOUND)
        
        name = request.data.get('name')
        clock_type = request.data.get('type', 'CUSTOM')
        max_segments = request.data.get('max_segments', 4)
        description = request.data.get('description', '')
        
        if not name:
            return Response({'error': 'Clock name is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate max_segments
        if max_segments not in [4, 6, 8]:
            return Response({
                'error': 'Max segments must be 4, 6, or 8'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create progress clock
        from .models import ProgressClock
        clock = ProgressClock.objects.create(
            name=name,
            clock_type=clock_type,
            max_segments=max_segments,
            description=description,
            character=character
        )
        
        return Response({
            'success': True,
            'clock_id': clock.id,
            'clock': {
                'id': clock.id,
                'name': clock.name,
                'type': clock.clock_type,
                'max_segments': clock.max_segments,
                'filled_segments': clock.filled_segments,
                'description': clock.description,
                'progress_percentage': clock.progress_percentage
            },
            'message': f'Created progress clock: {name}'
        })

    @action(detail=True, methods=['post'], url_path='update-progress-clock')
    def update_progress_clock(self, request, pk=None):
        """
        Update a progress clock's filled segments.
        """
        try:
            character = self.get_object()
        except Character.DoesNotExist:
            return Response({'error': 'Character not found'}, status=status.HTTP_404_NOT_FOUND)
        
        clock_id = request.data.get('clock_id')
        filled_segments = request.data.get('filled_segments')
        
        if not clock_id:
            return Response({'error': 'Clock ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if filled_segments is None:
            return Response({'error': 'Filled segments is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the clock
        from .models import ProgressClock
        try:
            clock = ProgressClock.objects.get(id=clock_id, character=character)
        except ProgressClock.DoesNotExist:
            return Response({'error': 'Progress clock not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Validate filled segments
        if filled_segments < 0 or filled_segments > clock.max_segments:
            return Response({
                'error': f'Filled segments must be between 0 and {clock.max_segments}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update clock
        clock.filled_segments = filled_segments
        if filled_segments >= clock.max_segments:
            clock.completed = True
        clock.save()
        
        return Response({
            'success': True,
            'clock_id': clock.id,
            'filled_segments': clock.filled_segments,
            'completed': clock.completed,
            'progress_percentage': clock.progress_percentage,
            'message': f'Updated progress clock: {clock.name}'
        })

    @action(detail=False, methods=['post'], url_path='create-template')
    def create_template(self, request):
        """
        Create a new character template with basic defaults.
        This creates a minimal character that can be fully customized on the character sheet.
        """
        character_data = request.data.get('character_data', {})
        
        # Set default values for a new character
        defaults = {
            'true_name': character_data.get('true_name', 'New Character'),
            'playbook': character_data.get('playbook', 'STAND'),
            'action_dots': {
                'insight': {'hunt': 0, 'study': 0, 'survey': 0, 'tinker': 0},
                'prowess': {'finesse': 0, 'prowl': 0, 'skirmish': 0, 'wreck': 0},
                'resolve': {'bizarre': 0, 'command': 0, 'consort': 0, 'sway': 0}
            },
            'stress': 0,
            'trauma': [],
            'loadout': 1,
            'healing_clock_segments': 4,
            'healing_clock_filled': 0,
            'xp_clocks': {
                'insight': 0,
                'prowess': 0,
                'resolve': 0,
                'heritage': 0,
                'playbook': 0
            },
            'coin_stats': {
                'power': 'C',
                'speed': 'C',
                'range': 'C',
                'durability': 'C',
                'precision': 'C',
                'development': 'C'
            }
        }
        
        # Override defaults with provided data
        defaults.update(character_data)
        
        # Create character
        serializer = CharacterSerializer(data=defaults)
        
        if serializer.is_valid():
            character = serializer.save(user=request.user)
            return Response({
                'success': True,
                'character_id': character.id,
                'character': CharacterSerializer(character).data,
                'message': 'Character template created successfully'
            })
        else:
            return Response({
                'error': 'Failed to create character template',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

class CampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer

    def get_queryset(self):
        user = self.request.user
        return Campaign.objects.filter(models.Q(gm=user) | models.Q(players=user)).distinct()

    def perform_create(self, serializer):
        # Automatically set the current user as the GM
        serializer.save(gm=self.request.user)
    def update(self, request, *args, **kwargs):
        campaign = self.get_object()
        if request.user != campaign.gm:
            return Response({'detail': 'Only the GM may edit this campaign.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        campaign = self.get_object()
        if request.user != campaign.gm:
            return Response({'detail': 'Only the GM may edit this campaign.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)


class NPCViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = NPC.objects.all()
    serializer_class = NPCSerializer

    def get_queryset(self):
        user = self.request.user
        # Allow users to see NPCs they created or NPCs in campaigns they GM
        return NPC.objects.filter(Q(creator=user) | Q(campaign__gm=user)).distinct()

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)


from django.db.models import Q

class CrewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Crew.objects.all()
    serializer_class = CrewSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Crew.objects.all()
        # Allow GMs to see all crews in their campaigns
        # Allow players to see crews they are a member of
        return Crew.objects.filter(Q(campaign__gm=user) | Q(members__user=user)).distinct()

    @action(detail=True, methods=['post'], url_path='propose-name')
    def propose_name(self, request, pk=None):
        crew = self.get_object()
        user = request.user
        new_name = request.data.get('new_name')

        if not new_name:
            return Response({'error': 'New name is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if the user is a member of the crew
        if not crew.members.filter(user=user).exists():
            return Response({'error': 'You are not a member of this crew.'}, status=status.HTTP_403_FORBIDDEN)

        crew.proposed_name = new_name
        crew.proposed_by = user
        crew.approved_by.clear()  # Clear previous approvals
        crew.approved_by.add(user) # Proposer automatically approves
        crew.save()

        return Response({
            'message': f'Proposed new name "{new_name}". Waiting for other members to approve.',
            'proposed_name': crew.proposed_name,
            'proposed_by': crew.proposed_by.username,
            'approved_by': [u.username for u in crew.approved_by.all()]
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='approve-name')
    def approve_name(self, request, pk=None):
        crew = self.get_object()
        user = request.user

        if not crew.proposed_name:
            return Response({'error': 'No name proposal is active.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if the user is a member of the crew
        if not crew.members.filter(user=user).exists():
            return Response({'error': 'You are not a member of this crew.'}, status=status.HTTP_403_FORBIDDEN)

        # Add user to approved_by if not already there
        if user not in crew.approved_by.all():
            crew.approved_by.add(user)
            crew.save()

        # Check for consensus
        # Get all unique users associated with characters in this crew
        all_member_users = set(crew.members.filter(user__isnull=False).values_list('user', flat=True))
        approved_user_ids = set(crew.approved_by.values_list('id', flat=True))

        # Check if all members have approved
        if all_member_users.issubset(approved_user_ids):
            crew.name = crew.proposed_name
            crew.proposed_name = None
            crew.proposed_by = None
            crew.approved_by.clear()
            crew.save()
            return Response({
                'message': f'Crew name changed to "{crew.name}" by consensus.',
                'new_crew_name': crew.name
            }, status=status.HTTP_200_OK)
        else:
            remaining_approvals = len(all_member_users) - len(approved_user_ids)
            return Response({
                'message': f'You approved the name. Waiting for {remaining_approvals} more approvals.',
                'proposed_name': crew.proposed_name,
                'proposed_by': crew.proposed_by.username if crew.proposed_by else None,
                'approved_by': [u.username for u in crew.approved_by.all()]
            }, status=status.HTTP_200_OK)

    def perform_update(self, serializer):
        crew = self.get_object()
        user = self.request.user

        # Allow GM to directly change the name
        if user == crew.campaign.gm:
            serializer.save()
            return

        # Prevent non-GM users from directly changing the name field
        if 'name' in serializer.validated_data and serializer.validated_data['name'] != crew.name:
            raise serializers.ValidationError({'name': 'Crew name can only be changed by consensus or by the GM.'})

        # Allow updates to proposed_name, proposed_by, approved_by fields for consensus mechanism
        allowed_fields_for_players = ['proposed_name', 'proposed_by', 'approved_by']
        for field in serializer.validated_data:
            if field not in allowed_fields_for_players:
                raise serializers.ValidationError({field: 'Only GM can directly edit this field.'})
        
        serializer.save()

class LoginView(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        password = request.data.get('password')
        
        user = authenticate(username=username, password=password)
        
        if not user:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'token': token.key,
            'user': {
                'id': user.id,
                'username': user.username
            }
        })


# === Custom API View ===

class SpendCoinAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            character = Character.objects.get(pk=pk)
        except Character.DoesNotExist:
            return Response({"error": "Character not found"}, status=404)

        crew = character.crew
        if not crew:
            return Response({"error": "Character has no crew"}, status=400)

        try:
            cost = int(request.data.get("cost", 0))
        except ValueError:
            return Response({"error": "Invalid coin amount"}, status=400)

        if cost > crew.coin:
            return Response({"error": "Not enough coin"}, status=400)

        crew.coin -= cost
        crew.save()
        return Response({"message": f"Spent {cost} coin from crew '{crew.name}'"}, status=200)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_search(request):
    """
    Global search endpoint that searches across characters, campaigns, NPCs, abilities, and heritages
    """
    query = request.GET.get('q', '').strip()
    
    if not query:
        return Response({
            'results': [],
            'message': 'No search query provided'
        })
    
    user = request.user
    results = []
    
    # Search Characters
    character_queryset = Character.objects.filter(
        Q(user=user) | Q(campaign__gm=user)
    ).filter(
        Q(true_name__icontains=query) |
        Q(alias__icontains=query) |
        Q(stand_name__icontains=query) |
        Q(background_note__icontains=query) |
        Q(heritage__name__icontains=query)
    )[:10]
    
    for char in character_queryset:
        results.append({
            'type': 'character',
            'id': char.id,
            'title': char.true_name or 'Unnamed Character',
            'subtitle': f"{char.heritage.name if char.heritage else 'Human'} • {char.playbook or 'STAND'} User",
            'description': f"Stand: {char.stand_name or 'Unnamed Stand'}",
            'url': f'/characters/{char.id}',
            'campaign': char.campaign.name if char.campaign else None
        })
    
    # Search Campaigns
    campaign_queryset = Campaign.objects.filter(
        Q(gm=user) | Q(players=user)
    ).filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    ).distinct()[:10]
    
    for campaign in campaign_queryset:
        results.append({
            'type': 'campaign',
            'id': campaign.id,
            'title': campaign.name,
            'subtitle': f"Campaign • GM: {campaign.gm.username}",
            'description': campaign.description or 'No description',
            'url': f'/campaigns',
            'campaign': campaign.name
        })
    
    # Search NPCs (only if user is GM)
    npc_queryset = NPC.objects.filter(
        campaign__gm=user
    ).filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    )[:10]
    
    for npc in npc_queryset:
        results.append({
            'type': 'npc',
            'id': npc.id,
            'title': npc.name,
            'subtitle': f"NPC • {npc.campaign.name}",
            'description': npc.description or 'No description',
            'url': f'/campaigns',
            'campaign': npc.campaign.name
        })
    
    # Search Abilities
    ability_queryset = Ability.objects.filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    )[:10]
    
    for ability in ability_queryset:
        results.append({
            'type': 'ability',
            'id': ability.id,
            'title': ability.name,
            'subtitle': f"Ability • {ability.type.title()}",
            'description': ability.description[:100] + '...' if len(ability.description) > 100 else ability.description,
            'url': f'/rules#abilities',
            'campaign': None
        })
    
    # Search Heritages
    heritage_queryset = Heritage.objects.filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    )[:10]
    
    for heritage in heritage_queryset:
        results.append({
            'type': 'heritage',
            'id': heritage.id,
            'title': heritage.name,
            'subtitle': f"Heritage • Base HP: {heritage.base_hp}",
            'description': heritage.description or 'No description',
            'url': f'/rules#heritages',
            'campaign': None
        })
    
    return Response({
        'results': results,
        'total': len(results),
        'query': query
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_available_playbook_abilities(request):
    """
    Get available Hamon/Spin abilities based on character's A-rank coin stats.
    Query params:
    - playbook: 'Hamon' or 'Spin'
    - coin_stats: JSON string of coin stats (e.g. '{"power":4,"speed":3,"range":5}')
    """
    playbook = request.GET.get('playbook')
    coin_stats_str = request.GET.get('coin_stats', '{}')
    
    try:
        coin_stats = json.loads(coin_stats_str) if coin_stats_str else {}
    except json.JSONDecodeError:
        return Response({'error': 'Invalid coin_stats JSON'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Count A-rank stats (value >= 4)
    a_rank_count = sum(1 for value in coin_stats.values() if value >= 4)
    
    available_abilities = []
    
    if playbook == 'Hamon':
        # Get all Hamon abilities
        all_abilities = HamonAbility.objects.all()
        
        # Foundation abilities are always available
        foundation_abilities = all_abilities.filter(hamon_type='FOUNDATION')
        for ability in foundation_abilities:
            available_abilities.append({
                'id': ability.id,
                'name': ability.name,
                'type': ability.hamon_type,
                'description': ability.description,
                'stress_cost': ability.stress_cost,
                'frequency': ability.frequency,
                'requirement': 'Foundation'
            })
        
        # A-rank dependent abilities
        if a_rank_count >= 1:
            # With 1 A-rank, can select some advanced abilities
            advanced_abilities = all_abilities.filter(hamon_type__in=['TRADITIONALIST', 'MEDICAL'])[:a_rank_count * 2]
            for ability in advanced_abilities:
                available_abilities.append({
                    'id': ability.id,
                    'name': ability.name,
                    'type': ability.hamon_type,
                    'description': ability.description,
                    'stress_cost': ability.stress_cost,
                    'frequency': ability.frequency,
                    'requirement': f'Requires {1} A-rank'
                })
                
    elif playbook == 'Spin':
        # Get all Spin abilities
        all_abilities = SpinAbility.objects.all()
        
        # Foundation abilities are always available
        foundation_abilities = all_abilities.filter(spin_type='FOUNDATION')
        for ability in foundation_abilities:
            available_abilities.append({
                'id': ability.id,
                'name': ability.name,
                'type': ability.spin_type,
                'description': ability.description,
                'stress_cost': ability.stress_cost,
                'frequency': ability.frequency,
                'requirement': 'Foundation'
            })
        
        # A-rank dependent abilities by tier
        cavalier_abilities = all_abilities.filter(spin_type='CAVALIER')
        
        # With 1 A: First 2 Cavalier abilities
        if a_rank_count >= 1:
            for ability in cavalier_abilities[:2]:
                available_abilities.append({
                    'id': ability.id,
                    'name': ability.name,
                    'type': ability.spin_type,
                    'description': ability.description,
                    'stress_cost': ability.stress_cost,
                    'frequency': ability.frequency,
                    'requirement': 'Requires 1 A-rank'
                })
        
        # With 2 A: Next 3 Cavalier abilities
        if a_rank_count >= 2:
            for ability in cavalier_abilities[2:5]:
                available_abilities.append({
                    'id': ability.id,
                    'name': ability.name,
                    'type': ability.spin_type,
                    'description': ability.description,
                    'stress_cost': ability.stress_cost,
                    'frequency': ability.frequency,
                    'requirement': 'Requires 2 A-ranks'
                })
        
        # With 3 A: Next 4 abilities
        if a_rank_count >= 3:
            for ability in cavalier_abilities[5:9]:
                available_abilities.append({
                    'id': ability.id,
                    'name': ability.name,
                    'type': ability.spin_type,
                    'description': ability.description,
                    'stress_cost': ability.stress_cost,
                    'frequency': ability.frequency,
                    'requirement': 'Requires 3 A-ranks'
                })
        
        # With 4 A: Advanced abilities
        if a_rank_count >= 4:
            architect_abilities = all_abilities.filter(spin_type='ARCHITECT')[:2]
            for ability in architect_abilities:
                available_abilities.append({
                    'id': ability.id,
                    'name': ability.name,
                    'type': ability.spin_type,
                    'description': ability.description,
                    'stress_cost': ability.stress_cost,
                    'frequency': ability.frequency,
                    'requirement': 'Requires 4 A-ranks'
                })
    
    return Response({
        'playbook': playbook,
        'a_rank_count': a_rank_count,
        'abilities': available_abilities,
        'total_available': len(available_abilities)
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def api_documentation(request):
    """
    Comprehensive API documentation for the character management system.
    """
    documentation = {
        'title': 'JoJo TTRPG Character Management API',
        'description': 'Complete API for managing characters, abilities, and game mechanics',
        'version': '1.0.0',
        'base_url': '/api/',
        
        'authentication': {
            'type': 'Token Authentication',
            'endpoints': {
                'login': {
                    'url': '/api/accounts/login/',
                    'method': 'POST',
                    'description': 'Authenticate user and get token',
                    'data': {
                        'username': 'string',
                        'password': 'string'
                    }
                },
                'signup': {
                    'url': '/api/accounts/signup/',
                    'method': 'POST',
                    'description': 'Create new user account',
                    'data': {
                        'username': 'string',
                        'password': 'string'
                    }
                }
            }
        },
        
        'character_management': {
            'overview': 'Single-page character sheet with real-time updates',
            'endpoints': {
                'list_characters': {
                    'url': '/api/characters/',
                    'method': 'GET',
                    'description': 'Get all characters for authenticated user',
                    'response': 'List of character objects'
                },
                'get_character': {
                    'url': '/api/characters/{id}/',
                    'method': 'GET',
                    'description': 'Get detailed character information',
                    'response': 'Complete character object with all related data'
                },
                'create_template': {
                    'url': '/api/characters/create-template/',
                    'method': 'POST',
                    'description': 'Create new character template with defaults',
                    'data': {
                        'character_data': {
                            'true_name': 'string (optional)',
                            'playbook': 'STAND|HAMON|SPIN (optional)'
                        }
                    }
                },
                'update_field': {
                    'url': '/api/characters/{id}/update-field/',
                    'method': 'PATCH',
                    'description': 'Update single field with immediate validation',
                    'data': {
                        'field': 'string (field name)',
                        'value': 'any (field value)'
                    },
                    'editable_fields': [
                        'true_name', 'alias', 'appearance', 'heritage', 'vice', 'vice_details',
                        'action_dots', 'coin_stats', 'stress', 'trauma', 'loadout',
                        'background_note', 'background_note2', 'close_friend', 'rival',
                        'stand_name', 'stand_form', 'stand_conscious', 'armor_type',
                        'light_armor_used', 'medium_armor_used', 'heavy_armor_used',
                        'harm_level1_used', 'harm_level1_name', 'harm_level2_used', 'harm_level2_name',
                        'harm_level3_used', 'harm_level3_name', 'harm_level4_used', 'harm_level4_name',
                        'healing_clock_filled', 'xp_clocks', 'custom_ability_description',
                        'custom_ability_type', 'extra_custom_abilities', 'faction_reputation',
                        'selected_benefits', 'selected_detriments', 'standard_abilities',
                        'hamon_ability_ids', 'spin_ability_ids'
                    ]
                }
            }
        },
        
        'game_mechanics': {
            'overview': 'Interactive game mechanics for character actions',
            'endpoints': {
                'roll_action': {
                    'url': '/api/characters/{id}/roll-action/',
                    'method': 'POST',
                    'description': 'Roll dice for an action with position and effect',
                    'data': {
                        'action': 'string (action name)',
                        'position': 'controlled|risky|desperate (optional)',
                        'effect': 'limited|standard|great (optional)'
                    },
                    'response': {
                        'action': 'string',
                        'action_rating': 'number',
                        'attribute_dice': 'number',
                        'total_dice': 'number',
                        'dice_results': 'array',
                        'max_result': 'number',
                        'outcome': 'critical_success|success|partial_success|failure',
                        'position': 'string',
                        'effect': 'string'
                    }
                },
                'indulge_vice': {
                    'url': '/api/characters/{id}/indulge-vice/',
                    'method': 'POST',
                    'description': 'Indulge vice to reduce stress',
                    'response': {
                        'vice': 'string',
                        'stress_relieved': 'number',
                        'new_stress': 'number'
                    }
                },
                'take_harm': {
                    'url': '/api/characters/{id}/take-harm/',
                    'method': 'POST',
                    'description': 'Take harm and update harm tracking',
                    'data': {
                        'level': '1|2|3|4',
                        'name': 'string (optional)'
                    }
                },
                'heal_harm': {
                    'url': '/api/characters/{id}/heal-harm/',
                    'method': 'POST',
                    'description': 'Heal harm and advance healing clock',
                    'data': {
                        'level': '1|2|3|4'
                    }
                }
            }
        },
        
        'progression': {
            'overview': 'Character advancement and progression tracking',
            'endpoints': {
                'add_xp': {
                    'url': '/api/characters/{id}/add-xp/',
                    'method': 'POST',
                    'description': 'Add XP to character tracks',
                    'data': {
                        'track': 'insight|prowess|resolve|heritage|playbook',
                        'amount': 'number (optional, default: 1)',
                        'trigger': 'string (optional)',
                        'description': 'string (optional)'
                    }
                },
                'add_progress_clock': {
                    'url': '/api/characters/{id}/add-progress-clock/',
                    'method': 'POST',
                    'description': 'Create new progress clock',
                    'data': {
                        'name': 'string',
                        'type': 'PROJECT|HEALING|COUNTDOWN|CUSTOM (optional)',
                        'max_segments': '4|6|8 (optional, default: 4)',
                        'description': 'string (optional)'
                    }
                },
                'update_progress_clock': {
                    'url': '/api/characters/{id}/update-progress-clock/',
                    'method': 'POST',
                    'description': 'Update progress clock segments',
                    'data': {
                        'clock_id': 'number',
                        'filled_segments': 'number'
                    }
                }
            }
        },
        
        'reference_data': {
            'overview': 'Game data and reference information',
            'endpoints': {
                'heritages': {
                    'url': '/api/heritages/',
                    'method': 'GET',
                    'description': 'Get all heritages with benefits and detriments'
                },
                'abilities': {
                    'url': '/api/abilities/',
                    'method': 'GET',
                    'description': 'Get standard abilities'
                },
                'hamon_abilities': {
                    'url': '/api/hamon-abilities/',
                    'method': 'GET',
                    'description': 'Get Hamon abilities'
                },
                'spin_abilities': {
                    'url': '/api/spin-abilities/',
                    'method': 'GET',
                    'description': 'Get Spin abilities'
                },
                'vices': {
                    'url': '/api/vices/',
                    'method': 'GET',
                    'description': 'Get available vices'
                },
                'traumas': {
                    'url': '/api/traumas/',
                    'method': 'GET',
                    'description': 'Get trauma types'
                },
                'creation_guide': {
                    'url': '/api/characters/creation-guide/',
                    'method': 'GET',
                    'description': 'Get character creation rules and options'
                }
            }
        },
        
        'campaign_management': {
            'overview': 'Campaign and crew management',
            'endpoints': {
                'campaigns': {
                    'url': '/api/campaigns/',
                    'method': 'GET|POST|PUT|DELETE',
                    'description': 'Manage campaigns'
                },
                'crews': {
                    'url': '/api/crews/',
                    'method': 'GET|POST|PUT|DELETE',
                    'description': 'Manage crews'
                },
                'npcs': {
                    'url': '/api/npcs/',
                    'method': 'GET|POST|PUT|DELETE',
                    'description': 'Manage NPCs'
                }
            }
        },
        
        'search': {
            'global_search': {
                'url': '/api/search/',
                'method': 'GET',
                'description': 'Search across all game data',
                'parameters': {
                    'q': 'string (search query)'
                }
            }
        },
        
        'usage_examples': {
            'create_character': {
                'description': 'Create a new character template',
                'request': {
                    'url': 'POST /api/characters/create-template/',
                    'data': {
                        'character_data': {
                            'true_name': 'Jotaro Kujo',
                            'playbook': 'STAND'
                        }
                    }
                }
            },
            'update_character_field': {
                'description': 'Update character name',
                'request': {
                    'url': 'PATCH /api/characters/1/update-field/',
                    'data': {
                        'field': 'true_name',
                        'value': 'Jotaro Kujo'
                    }
                }
            },
            'roll_action': {
                'description': 'Roll for Hunt action',
                'request': {
                    'url': 'POST /api/characters/1/roll-action/',
                    'data': {
                        'action': 'hunt',
                        'position': 'risky',
                        'effect': 'standard'
                    }
                }
            },
            'add_xp': {
                'description': 'Add XP to insight track',
                'request': {
                    'url': 'POST /api/characters/1/add-xp/',
                    'data': {
                        'track': 'insight',
                        'amount': 1,
                        'trigger': 'BELIEFS',
                        'description': 'Expressed character beliefs during scene'
                    }
                }
            }
        },
        
        'data_structures': {
            'character': {
                'description': 'Complete character data structure',
                'fields': {
                    'id': 'number',
                    'true_name': 'string',
                    'alias': 'string',
                    'appearance': 'string',
                    'heritage': 'object (Heritage)',
                    'playbook': 'STAND|HAMON|SPIN',
                    'action_dots': 'object (JSON)',
                    'coin_stats': 'object (JSON)',
                    'stress': 'number',
                    'trauma': 'array',
                    'loadout': 'number',
                    'vice': 'object (Vice)',
                    'stand_name': 'string',
                    'xp_clocks': 'object (JSON)',
                    'selected_benefits': 'array (Benefit IDs)',
                    'selected_detriments': 'array (Detriment IDs)',
                    'standard_abilities': 'array (Ability IDs)',
                    'hamon_ability_details': 'array (HamonAbility objects)',
                    'spin_ability_details': 'array (SpinAbility objects)'
                }
            },
            'action_dots': {
                'description': 'Action rating structure',
                'structure': {
                    'insight': {
                        'hunt': 'number (0-2)',
                        'study': 'number (0-2)',
                        'survey': 'number (0-2)',
                        'tinker': 'number (0-2)'
                    },
                    'prowess': {
                        'finesse': 'number (0-2)',
                        'prowl': 'number (0-2)',
                        'skirmish': 'number (0-2)',
                        'wreck': 'number (0-2)'
                    },
                    'resolve': {
                        'bizarre': 'number (0-2)',
                        'command': 'number (0-2)',
                        'consort': 'number (0-2)',
                        'sway': 'number (0-2)'
                    }
                },
                'rules': 'Total dots across all actions cannot exceed 7'
            },
            'coin_stats': {
                'description': 'Stand coin stat structure',
                'structure': {
                    'power': 'F|D|C|B|A|S',
                    'speed': 'F|D|C|B|A|S',
                    'range': 'F|D|C|B|A|S',
                    'durability': 'F|D|C|B|A|S',
                    'precision': 'F|D|C|B|A|S',
                    'development': 'F|D|C|B|A|S'
                },
                'rules': 'Total points cannot exceed 10'
            }
        }
    }
    
    return Response(documentation)
