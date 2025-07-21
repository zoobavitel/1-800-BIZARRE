from rest_framework import viewsets, permissions
from rest_framework.permissions import IsAuthenticated

from ..models import (
    Heritage, Vice, Ability, Stand, StandAbility, HamonAbility, SpinAbility,
    Trauma, CharacterHistory, ExperienceTracker
)
from ..serializers import (
    HeritageSerializer, ViceSerializer, AbilitySerializer, StandSerializer,
    StandAbilitySerializer, HamonAbilitySerializer, SpinAbilitySerializer,
    TraumaSerializer, CharacterHistorySerializer, ExperienceTrackerSerializer
)


class HeritageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Heritage.objects.all()
    serializer_class = HeritageSerializer


class ViceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Vice.objects.all()
    serializer_class = ViceSerializer


class AbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Ability.objects.all()
    serializer_class = AbilitySerializer


class StandViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Stand.objects.all()
    serializer_class = StandSerializer


class StandAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = StandAbility.objects.all()
    serializer_class = StandAbilitySerializer


class HamonAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = HamonAbility.objects.all()
    serializer_class = HamonAbilitySerializer


class SpinAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = SpinAbility.objects.all()
    serializer_class = SpinAbilitySerializer


class TraumaViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only endpoint for trauma conditions."""
    permission_classes = [IsAuthenticated]
    queryset = Trauma.objects.all()
    serializer_class = TraumaSerializer


class CharacterHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CharacterHistorySerializer

    def get_queryset(self):
        # Filter history based on user permissions
        user = self.request.user
        if user.is_staff:
            return CharacterHistory.objects.all()
        return CharacterHistory.objects.filter(character__user=user)


class ExperienceTrackerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ExperienceTrackerSerializer

    def get_queryset(self):
        # Filter experience trackers based on user permissions
        user = self.request.user
        if user.is_staff:
            return ExperienceTracker.objects.all()
        return ExperienceTracker.objects.filter(character__user=user)

    def perform_create(self, serializer):
        # Set the creator as the current user
        serializer.save(created_by=self.request.user) 