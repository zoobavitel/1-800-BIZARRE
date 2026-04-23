"""RollViewSet for dice roll history; GM can PATCH position/effect, create manual rolls, grant XP."""
from django.db import models
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Character, ExperienceTracker, Roll, RollHistory, Session
from ..roll_helpers import award_desperate_action_xp, normalize_effect, outcome_from_dice_results
from ..serializers import RollSerializer


class RollViewSet(viewsets.ModelViewSet):
    """List/retrieve rolls; GM can PATCH position/effect. Filter by campaign or session."""
    permission_classes = [IsAuthenticated]
    serializer_class = RollSerializer
    http_method_names = ['get', 'patch', 'post', 'head', 'options']

    def get_queryset(self):
        qs = Roll.objects.all().select_related('character', 'session', 'session__campaign')
        campaign_id = self.request.query_params.get('campaign')
        session_id = self.request.query_params.get('session')
        character_id = self.request.query_params.get('character')
        if campaign_id:
            qs = qs.filter(session__campaign_id=campaign_id)
        if session_id:
            qs = qs.filter(session_id=session_id)
        if character_id:
            qs = qs.filter(character_id=character_id)
        user = self.request.user
        if not user.is_staff:
            qs = qs.filter(
                models.Q(session__campaign__gm=user) |
                models.Q(session__campaign__characters__user=user) |
                models.Q(session__campaign__players=user)
            ).distinct()
        return qs.order_by('-timestamp')

    def partial_update(self, request, *args, **kwargs):
        """GM-only: update roll fields (position/effect and fortune visibility controls)."""
        roll = self.get_object()
        campaign = roll.session.campaign
        if campaign.gm_id != request.user.id and not request.user.is_staff:
            return Response(
                {'error': 'Only the GM can edit roll position/effect.'},
                status=status.HTTP_403_FORBIDDEN
            )
        position = request.data.get('position')
        effect = request.data.get('effect')
        updates = {}
        if position and position in ('controlled', 'risky', 'desperate'):
            updates['position'] = position
        if effect:
            ne = normalize_effect(effect)
            if ne in ('limited', 'standard', 'extreme'):
                updates['effect'] = ne
        if 'fortune_reveal_outcome' in request.data:
            updates['fortune_reveal_outcome'] = bool(request.data.get('fortune_reveal_outcome'))
        if 'fortune_public_label' in request.data:
            updates['fortune_public_label'] = str(request.data.get('fortune_public_label') or '').strip()[:120]
        if updates:
            for k, v in updates.items():
                setattr(roll, k, v)
            roll.save(update_fields=list(updates.keys()))
        return Response(RollSerializer(roll).data)

    @action(detail=True, methods=['post'], url_path='grant-xp')
    def grant_xp(self, request, pk=None):
        """GM-only: Grant 1 XP for a desperate action roll that has not yet awarded XP."""
        roll = self.get_object()
        campaign = roll.session.campaign
        if campaign.gm_id != request.user.id and not request.user.is_staff:
            return Response(
                {'error': 'Only the GM can grant XP from rolls.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if roll.position != 'desperate' or roll.roll_type != 'ACTION':
            return Response(
                {'error': 'Only desperate action rolls can award XP.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if ExperienceTracker.objects.filter(roll=roll).exists():
            return Response(
                {'error': 'XP already awarded for this roll.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        character = roll.character
        xp_awarded, track = award_desperate_action_xp(
            character, roll.session, roll, roll.action_name, request.user
        )
        if not xp_awarded or not track:
            return Response(
                {'error': f'Cannot map action "{roll.action_name}" to an attribute or track is capped.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        xp_clocks = character.xp_clocks or {}
        return Response({
            'success': True,
            'track': track,
            'amount': 1,
            'new_total': xp_clocks.get(track, 0),
        })

    def create(self, request, *args, **kwargs):
        """GM-only: create a manual roll (offline dice) for a character in a session."""
        session_id = request.data.get('session')
        character_id = request.data.get('character')
        if not session_id or not character_id:
            return Response(
                {'error': 'character and session are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session = get_object_or_404(Session, pk=session_id)
        character = get_object_or_404(Character, pk=character_id)
        if character.campaign_id != session.campaign_id:
            return Response(
                {'error': 'Character must belong to session campaign.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if session.campaign.gm_id != request.user.id and not request.user.is_staff:
            return Response(
                {'error': 'Only the GM can create manual rolls.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        roll = serializer.save(rolled_by=self.request.user)
        results = roll.results or []
        if not roll.outcome and results:
            roll.outcome = outcome_from_dice_results(results)
            roll.save(update_fields=['outcome'])
        RollHistory.objects.get_or_create(
            roll=roll,
            defaults={'campaign': roll.session.campaign},
        )
        if roll.position == 'desperate' and roll.roll_type == 'ACTION' and roll.action_name:
            award_desperate_action_xp(
                roll.character, roll.session, roll, roll.action_name, self.request.user
            )
