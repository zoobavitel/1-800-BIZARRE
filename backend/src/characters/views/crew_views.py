from django.db import models
from django.core.exceptions import PermissionDenied
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser

from ..models import Crew
from ..serializers import CrewSerializer

# Crew members (non-GM) may PATCH these fields; GM/staff have full access.
_CREW_MEMBER_ALLOWED_PATCH_FIELDS = frozenset({
    'name', 'stash_slots', 'description', 'upgrade_progress',
    'xp', 'xp_track_size', 'advancement_points', 'level', 'hold', 'rep', 'wanted_level',
    'coin', 'stash', 'image',
})


class CrewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Crew.objects.all()
    serializer_class = CrewSerializer
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def get_queryset(self):
        # Filter crews based on user permissions
        user = self.request.user
        if user.is_staff:
            return Crew.objects.all()
        # Return crews from campaigns where user is GM or a member
        return Crew.objects.filter(
            models.Q(campaign__gm=user) | models.Q(campaign__characters__user=user)
        ).distinct()

    @action(detail=True, methods=['post'], url_path='propose-name')
    def propose_name(self, request, pk=None):
        """Propose a new name for the crew (consensus flow)."""
        crew = self.get_object()
        proposed_name = (request.data.get('new_name') or request.data.get('name') or '').strip()

        if not proposed_name:
            return Response(
                {'error': 'Crew name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not self._is_crew_member(request.user, crew):
            return Response(
                {'error': 'You are not a member of this crew.'},
                status=status.HTTP_403_FORBIDDEN
            )

        crew.proposed_name = proposed_name
        crew.proposed_by = request.user
        crew.approved_by.clear()
        crew.approved_by.add(request.user)
        crew.save()

        return Response({
            'message': f'Proposed new name "{proposed_name}". Waiting for other members to approve.',
            'proposed_name': proposed_name,
            'proposed_by': request.user.username,
            'approved_by': [u.username for u in crew.approved_by.all()],
        })

    @action(detail=True, methods=['post'], url_path='approve-name')
    def approve_name(self, request, pk=None):
        """Crew members approve a proposed name; when all members have approved, rename."""
        crew = self.get_object()
        user = request.user

        if not crew.proposed_name:
            return Response(
                {'error': 'No name proposal is active.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not self._is_crew_member(user, crew):
            return Response(
                {'error': 'You are not a member of this crew.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if user not in crew.approved_by.all():
            crew.approved_by.add(user)
            crew.save()

        all_member_users = set(
            crew.members.filter(user__isnull=False).values_list('user', flat=True)
        )
        approved_user_ids = set(crew.approved_by.values_list('id', flat=True))

        if all_member_users.issubset(approved_user_ids):
            crew.name = crew.proposed_name
            crew.proposed_name = None
            crew.proposed_by = None
            crew.approved_by.clear()
            crew.save()
            return Response({
                'message': f'Crew name changed to "{crew.name}" by consensus.',
                'new_crew_name': crew.name,
            })

        remaining = len(all_member_users) - len(approved_user_ids)
        return Response({
            'message': f'You approved the name. Waiting for {remaining} more approvals.',
            'proposed_name': crew.proposed_name,
            'proposed_by': crew.proposed_by.username if crew.proposed_by else None,
            'approved_by': [u.username for u in crew.approved_by.all()],
        })

    def perform_update(self, serializer):
        crew = self.get_object()
        user = self.request.user
        # GM and staff can update anything
        if crew.campaign.gm == user or user.is_staff:
            serializer.save()
            crew.refresh_from_db()
            if 'name' in serializer.validated_data:
                crew.proposed_name = None
                crew.proposed_by = None
                crew.save(update_fields=['proposed_name', 'proposed_by'])
                crew.approved_by.clear()
            return
        # Crew members can update shared crew sheet fields (name, stash grid, resources, etc.)
        if self._is_crew_member(user, crew):
            validated = serializer.validated_data
            if set(validated.keys()) <= _CREW_MEMBER_ALLOWED_PATCH_FIELDS:
                serializer.save()
                crew.refresh_from_db()
                if 'name' in validated:
                    crew.proposed_name = None
                    crew.proposed_by = None
                    crew.save(update_fields=['proposed_name', 'proposed_by'])
                    crew.approved_by.clear()
                return
        raise PermissionDenied("Only the GM or crew members can update this crew")

    def _is_crew_member(self, user, crew):
        """Check if a user has a character in this crew."""
        return crew.members.filter(user=user).exists() 