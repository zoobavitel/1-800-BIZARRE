from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q

from ..models import NPC
from ..serializers import NPCSerializer

# Effect level to clock ticks (SRD: Limited=1, Standard=2, Great/Greater=3)
EFFECT_TO_TICKS = {'limited': 1, 'standard': 2, 'great': 3, 'greater': 3, 'extreme': 4}


class NPCViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = NPC.objects.all()
    serializer_class = NPCSerializer

    def get_queryset(self):
        user = self.request.user
        qs = NPC.objects.all() if user.is_staff else NPC.objects.filter(Q(creator=user) | Q(campaign__gm=user)).distinct()
        campaign_id = self.request.query_params.get('campaign')
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        return qs

    def _user_can_edit_npc_clocks(self, request, npc):
        """Only GM (campaign GM or NPC creator) can tick NPC clocks. Players cannot deal harm to NPCs."""
        user = request.user
        if user.is_staff:
            return True
        if npc.creator_id and npc.creator_id == user.id:
            return True
        if npc.campaign_id and getattr(npc.campaign, 'gm_id', None) == user.id:
            return True
        return False

    @action(detail=True, methods=['post'], url_path='apply-effect')
    def apply_effect(self, request, pk=None):
        """
        GM-only: Apply the effect of a roll to an NPC's clock. Players do not deal harm to NPCs;
        the GM uses this to tick vulnerability, harm, or narrative clocks based on player roll effect.
        Effect → ticks: limited=1, standard=2, greater/great=3, extreme=4.
        """
        npc = self.get_object()
        if not self._user_can_edit_npc_clocks(request, npc):
            return Response(
                {'error': 'Only the GM (or NPC creator) can apply effect to NPC clocks. Players cannot deal harm to NPCs.'},
                status=status.HTTP_403_FORBIDDEN
            )
        effect = (request.data.get('effect') or '').strip().lower()
        clock_type = (request.data.get('clock_type') or 'vulnerability').strip().lower()
        if effect not in EFFECT_TO_TICKS:
            return Response(
                {'error': f'effect must be one of: {", ".join(EFFECT_TO_TICKS)}', 'effect': effect},
                status=status.HTTP_400_BAD_REQUEST
            )
        if clock_type not in ('vulnerability', 'harm'):
            return Response(
                {'error': 'clock_type must be "vulnerability" or "harm"', 'clock_type': clock_type},
                status=status.HTTP_400_BAD_REQUEST
            )
        ticks = EFFECT_TO_TICKS[effect]
        if clock_type == 'vulnerability':
            max_segments = npc.vulnerability_clock_max
            current = npc.vulnerability_clock_current
            new_value = min(current + ticks, max_segments)
            npc.vulnerability_clock_current = new_value
            npc.save(update_fields=['vulnerability_clock_current'])
            return Response({
                'clock_type': 'vulnerability',
                'effect': effect,
                'ticks_applied': ticks,
                'previous': current,
                'current': new_value,
                'max': max_segments,
                'defeated': new_value >= max_segments and max_segments > 0,
            })
        else:
            max_segments = npc.harm_clock_max
            current = npc.harm_clock_current
            new_value = min(current + ticks, max_segments)
            npc.harm_clock_current = new_value
            npc.save(update_fields=['harm_clock_current'])
            return Response({
                'clock_type': 'harm',
                'effect': effect,
                'ticks_applied': ticks,
                'previous': current,
                'current': new_value,
                'max': max_segments,
                'filled': new_value >= max_segments,
            })

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user) 