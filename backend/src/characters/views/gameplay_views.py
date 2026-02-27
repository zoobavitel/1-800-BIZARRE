from django.db import models
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from ..models import (
    Claim, CrewSpecialAbility, CrewPlaybook, CrewUpgrade,
    XPHistory, StressHistory, ChatMessage, ProgressClock
)
from ..serializers import (
    ClaimSerializer, CrewSpecialAbilitySerializer, CrewPlaybookSerializer,
    CrewUpgradeSerializer, XPHistorySerializer, StressHistorySerializer,
    ChatMessageSerializer, ProgressClockSerializer
)


class ClaimViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Claim.objects.all()
    serializer_class = ClaimSerializer


class CrewSpecialAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = CrewSpecialAbility.objects.all()
    serializer_class = CrewSpecialAbilitySerializer


class CrewPlaybookViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = CrewPlaybook.objects.all()
    serializer_class = CrewPlaybookSerializer


class CrewUpgradeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = CrewUpgrade.objects.all()
    serializer_class = CrewUpgradeSerializer


class XPHistoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = XPHistory.objects.all()
    serializer_class = XPHistorySerializer


class StressHistoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = StressHistory.objects.all()
    serializer_class = StressHistorySerializer


class ChatMessageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = ChatMessage.objects.all()
    serializer_class = ChatMessageSerializer


class ProgressClockViewSet(viewsets.ModelViewSet):
    """CRUD for progress clocks. GM-only create/update/delete; filter by campaign/session."""
    permission_classes = [IsAuthenticated]
    serializer_class = ProgressClockSerializer

    def get_queryset(self):
        qs = ProgressClock.objects.all()
        campaign_id = self.request.query_params.get('campaign')
        session_id = self.request.query_params.get('session')
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        if session_id:
            qs = qs.filter(session_id=session_id)
        user = self.request.user
        if not user.is_staff:
            qs = qs.filter(
                models.Q(campaign__gm=user) |
                models.Q(campaign__characters__user=user) |
                models.Q(campaign__players=user)
            ).distinct()
        return qs

    def perform_create(self, serializer):
        campaign = serializer.validated_data.get('campaign')
        if campaign and campaign.gm != self.request.user and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only the GM can create progress clocks.')
        serializer.save()

    def perform_update(self, serializer):
        obj = serializer.instance
        if obj.campaign and obj.campaign.gm != self.request.user and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only the GM can update progress clocks.')
        if not obj.campaign and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only staff can update clocks without a campaign.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.campaign and instance.campaign.gm != self.request.user and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only the GM can delete progress clocks.')
        if not instance.campaign and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only staff can delete clocks without a campaign.')
        instance.delete()