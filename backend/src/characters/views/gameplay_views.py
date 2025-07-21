from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from ..models import (
    Claim, CrewSpecialAbility, CrewPlaybook, CrewUpgrade,
    XPHistory, StressHistory, ChatMessage
)
from ..serializers import (
    ClaimSerializer, CrewSpecialAbilitySerializer, CrewPlaybookSerializer,
    CrewUpgradeSerializer, XPHistorySerializer, StressHistorySerializer,
    ChatMessageSerializer
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