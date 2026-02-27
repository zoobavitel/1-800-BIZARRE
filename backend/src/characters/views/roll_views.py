"""RollViewSet for dice roll history; GM can PATCH position/effect."""
from django.db import models
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Roll
from ..serializers import RollSerializer


class RollViewSet(viewsets.ModelViewSet):
    """List/retrieve rolls; GM can PATCH position/effect. Filter by campaign or session."""
    permission_classes = [IsAuthenticated]
    serializer_class = RollSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

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
