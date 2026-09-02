import logging

from django.db import models
from django.db.models import Prefetch
from django.core.exceptions import PermissionDenied
from rest_framework import viewsets, status, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action

from ..models import Session, SessionEvent, Roll, Character
from ..serializers import SessionSerializer, SessionEventSerializer, SessionRecordsSerializer

logger = logging.getLogger(__name__)


class IsCampaignGMOrReadOnly(permissions.BasePermission):
    """Custom permission to allow campaign GMs to edit sessions."""
    
    def has_permission(self, request, view):
        # Allow read-only access for any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the GM of the campaign
        if obj.campaign.gm == request.user or request.user.is_staff:
            return True

        # Players may PATCH only loadout_by_character (own entry checked in perform_update).
        if request.method in ("PATCH", "PUT"):
            data_keys = set(getattr(request, "data", {}) or {})
            if data_keys <= {"loadout_by_character"}:
                return True
        return False


class SessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCampaignGMOrReadOnly]
    serializer_class = SessionSerializer

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SessionRecordsSerializer
        return SessionSerializer

    def get_queryset(self):
        # Filter sessions based on user permissions
        user = self.request.user
        rolls_qs = Roll.objects.select_related("rolled_by", "character").order_by(
            "-timestamp"
        )
        base = Session.objects.all() if user.is_staff else Session.objects.filter(
            models.Q(campaign__gm=user)
            | models.Q(campaign__characters__user=user)
            | models.Q(campaign__players=user)
        ).distinct()

        # Narrow by query params so a campaign-scoped list page doesn't
        # accidentally show or affect sessions from other campaigns the
        # user happens to be a member of.
        campaign_id = self.request.query_params.get("campaign")
        if campaign_id:
            base = base.filter(campaign_id=campaign_id)
        status_param = self.request.query_params.get("status")
        if status_param:
            base = base.filter(status=status_param)

        return base.prefetch_related(Prefetch("rolls", queryset=rolls_qs))

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        session = self.get_object()
        user = self.request.user
        is_gm = session.campaign.gm == user or user.is_staff

        if not is_gm:
            data_keys = set(self.request.data.keys())
            allowed_only = data_keys <= {"loadout_by_character"}
            if not allowed_only:
                raise PermissionDenied("Only the GM can update this session")
            char = Character.objects.filter(
                user=user, campaign_id=session.campaign_id
            ).first()
            if not char:
                raise PermissionDenied("No character in this campaign")
            patch = self.request.data.get("loadout_by_character")
            if not isinstance(patch, dict) or len(patch) != 1:
                raise PermissionDenied(
                    "Players may only update their own loadout entry"
                )
            char_key = str(char.id)
            if str(next(iter(patch.keys()))) != char_key:
                raise PermissionDenied(
                    "Players may only update their own loadout entry"
                )
            serializer.save()
            return

        prev_status = session.status
        instance = serializer.save()
        skip = getattr(instance, "_skip_encoded_xp_settlement", False)
        try:
            delattr(instance, "_skip_encoded_xp_settlement")
        except AttributeError:
            pass

        if prev_status != "COMPLETED" and instance.status == "COMPLETED":
            try:
                from ..services.session_xp_settlement import (
                    mark_encoded_session_xp_settled_without_xp,
                    settle_encoded_session_xp,
                )

                if skip:
                    mark_encoded_session_xp_settled_without_xp(
                        instance, self.request.user
                    )
                else:
                    settle_encoded_session_xp(instance, self.request.user)
            except Exception:
                logger.exception(
                    "Encoded session XP settlement failed on session COMPLETED "
                    "(session=%s)",
                    instance.id,
                )
            try:
                from ..services.crew_xp_triggers import (
                    credit_crew_xp_triggers_for_session,
                )

                credit_crew_xp_triggers_for_session(instance, self.request.user)
            except Exception:
                logger.exception(
                    "Crew XP trigger credit failed on session COMPLETED "
                    "(session=%s)",
                    instance.id,
                )
        elif prev_status == "COMPLETED" and instance.status == "PLANNED":
            logger.info(
                "session reopened to PLANNED (session=%s user=%s)",
                instance.id,
                getattr(self.request.user, "id", None),
            )

    def perform_destroy(self, instance):
        try:
            from ..services.session_xp_settlement import (
                settle_encoded_session_xp,
            )

            settle_encoded_session_xp(instance, self.request.user)
        except Exception:
            logger.exception(
                "Encoded session XP settlement failed before session DELETE "
                "(session=%s)",
                instance.id,
            )
        try:
            from ..services.crew_xp_triggers import (
                credit_crew_xp_triggers_for_session,
            )

            credit_crew_xp_triggers_for_session(instance, self.request.user)
        except Exception:
            logger.exception(
                "Crew XP trigger credit failed before session DELETE "
                "(session=%s)",
                instance.id,
            )
        super().perform_destroy(instance)

    @action(detail=True, methods=['post'], url_path='propose-score')
    def propose_score(self, request, pk=None):
        """Propose a score for the session."""
        session = self.get_object()
        score_data = request.data
        
        # Validate score data
        required_fields = ['title', 'description']
        for field in required_fields:
            if field not in score_data:
                return Response(
                    {'error': f'Field {field} is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create score proposal (simplified - you'd implement actual score mechanics)
        return Response({
            'message': 'Score proposed successfully',
            'score': score_data
        })

    @action(detail=True, methods=['post'], url_path='vote-for-score')
    def vote_for_score(self, request, pk=None):
        """Vote for a proposed score."""
        session = self.get_object()
        score_id = request.data.get('score_id')
        vote = request.data.get('vote')  # 'yes' or 'no'
        
        if not score_id or vote not in ['yes', 'no']:
            return Response(
                {'error': 'Score ID and vote (yes/no) are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Process vote (simplified - you'd implement actual voting mechanics)
        return Response({
            'message': f'Vote recorded: {vote}',
            'score_id': score_id,
            'vote': vote
        })


class SessionEventViewSet(viewsets.ModelViewSet):
    queryset = SessionEvent.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = SessionEventSerializer

    def get_queryset(self):
        # Filter events based on user permissions
        user = self.request.user
        if user.is_staff:
            return SessionEvent.objects.all()
        # Return events from sessions where user is GM or a member
        return SessionEvent.objects.filter(
            models.Q(session__campaign__gm=user) | 
            models.Q(session__campaign__characters__user=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save()