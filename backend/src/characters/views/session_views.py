from django.db import models
from django.core.exceptions import PermissionDenied
from rest_framework import viewsets, status, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action

from ..models import Session, SessionEvent
from ..serializers import SessionSerializer, SessionEventSerializer


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
        return obj.campaign.gm == request.user or request.user.is_staff


class SessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCampaignGMOrReadOnly]
    serializer_class = SessionSerializer

    def get_queryset(self):
        # Filter sessions based on user permissions
        user = self.request.user
        if user.is_staff:
            return Session.objects.all()
        # Return sessions from campaigns where user is GM or a member
        return Session.objects.filter(
            models.Q(campaign__gm=user) | models.Q(campaign__characters__user=user)
        ).distinct()

    def perform_create(self, serializer):
        # Set the creator as the current user
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        # Ensure only the GM can update the session
        session = self.get_object()
        if session.campaign.gm != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("Only the GM can update this session")
        serializer.save()

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
        # Set the creator as the current user
        serializer.save(created_by=self.request.user) 