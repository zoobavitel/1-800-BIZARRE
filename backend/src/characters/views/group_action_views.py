"""Group action: multiple rolls in one beat; leader stress for failed rolls."""
from django.db import models
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Character, GroupAction, Roll, Session
from ..roll_helpers import (
    action_roll_counts_as_failure_for_group,
    max_stress_slots_for_character,
)
from ..serializers import GroupActionSerializer


def _is_failure_roll(roll):
    """Same tier die as outcome; tier 1–3 counts failed for leader stress."""
    return action_roll_counts_as_failure_for_group(
        roll.results or [],
        getattr(roll, "dice_pool", None),
        getattr(roll, "pool_action_rating", None),
    )


def _group_participants(ga):
    campaign_chars = list(ga.session.campaign.characters.all())
    if ga.leader.crew_id:
        same_crew = [c for c in campaign_chars if c.crew_id == ga.leader.crew_id]
        if same_crew:
            return same_crew
    return campaign_chars


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
        action_name = str(request.data.get('action_name') or '').strip().lower()
        goal_label = (request.data.get('goal_label') or '').strip()
        if not session_id or not leader_id or not action_name:
            return Response(
                {'error': 'session, leader, and action_name are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session = Session.objects.select_related('campaign').filter(pk=session_id).first()
        if not session:
            return Response({'error': 'Invalid session.'}, status=status.HTTP_400_BAD_REQUEST)
        leader = Character.objects.filter(pk=leader_id).first()
        if not leader or leader.campaign_id != session.campaign_id:
            return Response({'error': 'Leader must be a PC in the session campaign.'}, status=status.HTTP_400_BAD_REQUEST)
        camp = session.campaign
        if camp.gm_id != request.user.id and leader.user_id != request.user.id and not request.user.is_staff:
            return Response({'error': 'Only the GM or leader can start a group action.'}, status=status.HTTP_403_FORBIDDEN)
        ga = GroupAction.objects.create(
            session=session,
            leader=leader,
            action_name=action_name,
            goal_label=goal_label,
            status='OPEN',
        )
        return Response(GroupActionSerializer(ga).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_action(self, request, pk=None):
        ga = self.get_object()
        if ga.status != 'OPEN':
            return Response(
                {'error': 'Only an open group action can be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        camp = ga.session.campaign
        if (
            camp.gm_id != request.user.id
            and ga.leader.user_id != request.user.id
            and not request.user.is_staff
        ):
            return Response(
                {'error': 'Only the GM or group leader can cancel a group action.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        ga.status = 'CANCELLED'
        ga.save(update_fields=['status'])
        return Response(GroupActionSerializer(ga).data)

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve_action(self, request, pk=None):
        ga = self.get_object()
        if ga.status != 'OPEN':
            if ga.status == 'RESOLVED':
                return Response({'error': 'Already resolved.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response(
                {'error': 'This group action is not open.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        camp = ga.session.campaign
        if (
            camp.gm_id != request.user.id
            and ga.leader.user_id != request.user.id
            and not request.user.is_staff
        ):
            return Response(
                {'error': 'Only the GM or leader can resolve a group action.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        participants = _group_participants(ga)
        rolls = list(
            Roll.objects.filter(group_action=ga, roll_type='ACTION', action_name__iexact=ga.action_name)
            .select_related('character')
            .order_by('-timestamp')
        )
        rolled_character_ids = {r.character_id for r in rolls}
        missing = [p.true_name for p in participants if p.id not in rolled_character_ids]
        if missing:
            return Response(
                {
                    'error': 'Cannot resolve until all participants have rolled.',
                    'missing_players': missing,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        failures = sum(
            1
            for r in rolls
            if _is_failure_roll(r) and r.character_id != ga.leader_id
        )
        leader = ga.leader
        max_slots = max_stress_slots_for_character(leader)
        cur = max(
            0,
            min(max_slots, int(getattr(leader, "stress", 0) or 0)),
        )
        # Character.stress = marked boxes; each non-leader failure marks 1 on the leader.
        new_stress = min(max_slots, cur + failures)
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
