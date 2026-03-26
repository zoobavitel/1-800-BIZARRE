"""Group action: multiple rolls in one beat; leader stress for failed rolls."""
from django.db import models
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Character, GroupAction, Roll, Session
from ..serializers import GroupActionSerializer


def _is_failure_roll(roll):
    """BitD: highest die 1–3 counts as failure for group tally."""
    dice = roll.results or []
    if not dice:
        return True
    return max(dice) <= 3


class GroupActionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = GroupAction.objects.all()
    serializer_class = GroupActionSerializer
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        qs = GroupAction.objects.all().select_related('session', 'session__campaign', 'leader')
        session_id = self.request.query_params.get('session')
        if session_id:
            qs = qs.filter(session_id=session_id)
        user = self.request.user
        if not user.is_staff:
            qs = qs.filter(
                models.Q(session__campaign__gm=user)
                | models.Q(session__campaign__characters__user=user)
                | models.Q(session__campaign__players=user)
                | models.Q(leader__user=user)
            ).distinct()
        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        session_id = request.data.get('session')
        leader_id = request.data.get('leader')
        goal_label = (request.data.get('goal_label') or '').strip()
        if not session_id or not leader_id:
            return Response({'error': 'session and leader are required.'}, status=status.HTTP_400_BAD_REQUEST)
        session = Session.objects.select_related('campaign').filter(pk=session_id).first()
        if not session:
            return Response({'error': 'Invalid session.'}, status=status.HTTP_400_BAD_REQUEST)
        leader = Character.objects.filter(pk=leader_id).first()
        if not leader or leader.campaign_id != session.campaign_id:
            return Response({'error': 'Leader must be a PC in the session campaign.'}, status=status.HTTP_400_BAD_REQUEST)
        camp = session.campaign
        if camp.gm_id != request.user.id and leader.user_id != request.user.id and not request.user.is_staff:
            return Response({'error': 'Only the GM or leader can start a group action.'}, status=status.HTTP_403_FORBIDDEN)
        ga = GroupAction.objects.create(session=session, leader=leader, goal_label=goal_label, status='OPEN')
        return Response(GroupActionSerializer(ga).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve_action(self, request, pk=None):
        ga = self.get_object()
        if ga.status == 'RESOLVED':
            return Response({'error': 'Already resolved.'}, status=status.HTTP_400_BAD_REQUEST)
        camp = ga.session.campaign
        if camp.gm_id != request.user.id and not request.user.is_staff:
            return Response({'error': 'Only the GM can resolve a group action.'}, status=status.HTTP_403_FORBIDDEN)
        rolls = list(Roll.objects.filter(group_action=ga))
        failures = sum(1 for r in rolls if _is_failure_roll(r))
        leader = ga.leader
        cur = getattr(leader, 'stress', 0) or 0
        new_stress = min(9, cur + failures)
        leader.stress = new_stress
        leader.save(update_fields=['stress'])
        ga.status = 'RESOLVED'
        ga.save(update_fields=['status'])
        return Response({
            'failures': failures,
            'rolls_count': len(rolls),
            'leader_stress_before': cur,
            'leader_stress_after': new_stress,
        })
