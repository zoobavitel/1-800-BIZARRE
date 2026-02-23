from django.db import models
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

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
