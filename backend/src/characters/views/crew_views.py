from django.db import models
from django.core.exceptions import PermissionDenied
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser

from ..models import Crew
from ..serializers import CrewSerializer


class CrewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Crew.objects.all()
    serializer_class = CrewSerializer
    parser_classes = (MultiPartParser, FormParser)

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
        """Propose a new name for the crew."""
        crew = self.get_object()
        proposed_name = request.data.get('name')
        
        if not proposed_name:
            return Response(
                {'error': 'Crew name is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user is part of the crew
        if not self._is_crew_member(request.user, crew):
            return Response(
                {'error': 'Only crew members can propose names'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Update the proposed name
        crew.proposed_name = proposed_name
        crew.save()
        
        return Response({
            'message': f'Proposed name: {proposed_name}',
            'proposed_name': proposed_name
        })

    @action(detail=True, methods=['post'], url_path='approve-name')
    def approve_name(self, request, pk=None):
        """Approve the proposed crew name."""
        crew = self.get_object()
        
        # Check if user is the GM of the campaign
        if crew.campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {'error': 'Only the GM can approve crew names'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not crew.proposed_name:
            return Response(
                {'error': 'No proposed name to approve'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Approve the name
        crew.name = crew.proposed_name
        crew.proposed_name = None
        crew.save()
        
        return Response({
            'message': f'Crew name approved: {crew.name}',
            'approved_name': crew.name
        })

    def perform_update(self, serializer):
        # Ensure only the GM can update the crew
        crew = self.get_object()
        if crew.campaign.gm != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("Only the GM can update this crew")
        serializer.save()

    def _is_crew_member(self, user, crew):
        """Check if a user is a member of the crew."""
        return crew.campaign.characters.filter(user=user).exists() 