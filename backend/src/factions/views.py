from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Faction, FactionRelationship, CrewFactionRelationship
from .serializers import FactionSerializer, FactionRelationshipSerializer, CrewFactionRelationshipSerializer

class FactionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Faction.objects.all()
    serializer_class = FactionSerializer

class FactionRelationshipViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = FactionRelationship.objects.all()
    serializer_class = FactionRelationshipSerializer

class CrewFactionRelationshipViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = CrewFactionRelationship.objects.all()
    serializer_class = CrewFactionRelationshipSerializer