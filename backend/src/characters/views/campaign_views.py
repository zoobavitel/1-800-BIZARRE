from django.db import models
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Campaign
from ..serializers import CampaignSerializer


class CampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer

    def get_queryset(self):
        # Filter campaigns based on user permissions
        user = self.request.user
        if user.is_staff:
            return Campaign.objects.all()
        # Return campaigns where user is GM or a member
        return Campaign.objects.filter(
            models.Q(gm=user) | models.Q(characters__user=user)
        ).distinct()

    def perform_create(self, serializer):
        # Automatically set the current user as the GM
        serializer.save(gm=self.request.user)

    def update(self, request, *args, **kwargs):
        # Ensure only the GM can update the campaign
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {'error': 'Only the GM can update this campaign'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        # Ensure only the GM can update the campaign
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {'error': 'Only the GM can update this campaign'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().partial_update(request, *args, **kwargs) 