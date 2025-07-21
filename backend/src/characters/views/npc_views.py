from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from ..models import NPC
from ..serializers import NPCSerializer


class NPCViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = NPC.objects.all()
    serializer_class = NPCSerializer

    def get_queryset(self):
        # Filter NPCs based on user permissions
        user = self.request.user
        if user.is_staff:
            return NPC.objects.all()
        # Return NPCs from campaigns where user is GM
        return NPC.objects.filter(campaign__gm=user)

    def perform_create(self, serializer):
        # Set the creator as the current user
        serializer.save(created_by=self.request.user) 