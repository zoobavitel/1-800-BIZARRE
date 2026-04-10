from django.db import models
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Campaign, Faction
from ..serializers import FactionSerializer


class FactionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Faction.objects.all()
    serializer_class = FactionSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Faction.objects.select_related('campaign')
        if user.is_staff:
            base = qs
        else:
            base = qs.filter(
                models.Q(campaign__gm=user) | models.Q(campaign__characters__user=user)
            ).distinct()
        campaign_id = self.request.query_params.get('campaign')
        if campaign_id:
            return base.filter(campaign_id=campaign_id)
        return base

    def _assert_gm(self, request, campaign):
        """Raise PermissionDenied unless the requester is the campaign GM or staff."""
        if request.user.is_staff:
            return
        if campaign.gm_id != request.user.id:
            self.permission_denied(
                request,
                message="Only the campaign GM can create or modify factions.",
                code="gm_only",
            )

    def create(self, request, *args, **kwargs):
        campaign_id = request.data.get('campaign')
        try:
            campaign = Campaign.objects.get(pk=campaign_id)
        except Campaign.DoesNotExist:
            return Response({'error': 'Campaign not found.'}, status=status.HTTP_400_BAD_REQUEST)
        self._assert_gm(request, campaign)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        faction = self.get_object()
        self._assert_gm(request, faction.campaign)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        faction = self.get_object()
        self._assert_gm(request, faction.campaign)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        faction = self.get_object()
        self._assert_gm(request, faction.campaign)
        return super().destroy(request, *args, **kwargs)
