"""RollViewSet for dice roll history; GM can PATCH position/effect and grant XP."""
from django.db import models
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Roll, ExperienceTracker
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
        """GM-only: update position and effect on a roll."""
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
            if effect == 'great':
                effect = 'greater'
            if effect in ('limited', 'standard', 'greater'):
                updates['effect'] = effect
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
        action_name = (roll.action_name or '').lower()
        track = None
        if action_name in ['hunt', 'study', 'survey', 'tinker']:
            track = 'insight'
        elif action_name in ['finesse', 'prowl', 'skirmish', 'wreck']:
            track = 'prowess'
        elif action_name in ['bizarre', 'command', 'consort', 'sway']:
            track = 'resolve'
        if not track:
            return Response(
                {'error': f'Cannot map action "{roll.action_name}" to an attribute.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        character = roll.character
        xp_clocks = character.xp_clocks or {}
        current = xp_clocks.get(track, 0)
        if current >= 5:
            return Response(
                {'error': f'{track} track is already at cap (5).'},
                status=status.HTTP_400_BAD_REQUEST
            )
        xp_clocks[track] = current + 1
        character.xp_clocks = xp_clocks
        character.save(update_fields=['xp_clocks'])
        ExperienceTracker.objects.create(
            character=character,
            session=roll.session,
            roll=roll,
            trigger='DESPERATE_ROLL',
            description=f'Desperate roll: {roll.action_name}',
            xp_gained=1
        )
        return Response({
            'success': True,
            'track': track,
            'amount': 1,
            'new_total': xp_clocks[track],
        })
