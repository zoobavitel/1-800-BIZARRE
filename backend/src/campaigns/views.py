from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from django.core.exceptions import PermissionDenied

from .models import Campaign, Session, ChatMessage
from .serializers import CampaignSerializer, SessionSerializer, ChatMessageSerializer

# Import models from other apps that are referenced
from characters.models import Character, NPC, Faction # Assuming these will remain in characters app for now


class IsCampaignGMOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow GMs of a campaign to edit sessions.
    """
    def has_permission(self, request, view):
        # Allow read-only access for any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        # Write permissions are only allowed to GMs
        return request.user and request.user.is_authenticated and Campaign.objects.filter(gm=request.user).exists()

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
        # Write permissions are only allowed to the GM of the campaign
        return obj.campaign.gm == request.user


class CampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer

    def get_queryset(self):
        user = self.request.user
        return Campaign.objects.filter(Q(gm=user) | Q(players=user)).distinct()

    def perform_create(self, serializer):
        # Automatically set the current user as the GM
        serializer.save(gm=self.request.user)
    def update(self, request, *args, **kwargs):
        campaign = self.get_object()
        if request.user != campaign.gm:
            return Response({'detail': 'Only the GM may edit this campaign.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        campaign = self.get_object()
        if request.user != campaign.gm:
            return Response({'detail': 'Only the GM may edit this campaign.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)


class SessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCampaignGMOrReadOnly]
    serializer_class = SessionSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Session.objects.all()
        
        # GMs can see all sessions in their campaigns
        if Campaign.objects.filter(gm=user).exists():
            return Session.objects.filter(campaign__gm=user)
            
        # Players can see sessions in campaigns they are part of
        return Session.objects.filter(campaign__players=user).distinct()

    def perform_create(self, serializer):
        campaign = serializer.validated_data.get('campaign')
        if not campaign or campaign.gm != self.request.user:
            raise PermissionDenied("You are not the GM of this campaign and cannot create sessions for it.")
        serializer.save()

    def perform_update(self, serializer):
        campaign = serializer.validated_data.get('campaign', serializer.instance.campaign)
        if campaign.gm != self.request.user:
            raise PermissionDenied("You are not the GM of this campaign and cannot edit sessions for it.")
        serializer.save()

    @action(detail=True, methods=['post'], url_path='propose-score')
    def propose_score(self, request, pk=None):
        session = self.get_object()
        user = request.user
        proposed_score_target = request.data.get('proposed_score_target')
        proposed_score_description = request.data.get('proposed_score_description', '')

        if not proposed_score_target:
            return Response({'error': 'Proposed score target is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Only players in the campaign can propose scores
        if not session.campaign.players.filter(id=user.id).exists() and session.campaign.gm != user:
            return Response({'error': 'You must be a player or GM in this campaign to propose a score.'}, status=status.HTTP_403_FORBIDDEN)

        session.proposed_score_target = proposed_score_target
        session.proposed_score_description = proposed_score_description
        session.proposed_by = user
        session.votes.clear()  # Clear previous votes
        session.votes.add(user) # Proposer automatically votes for their proposal
        session.save()

        return Response({
            'message': f'Score "{proposed_score_target}" proposed.',
            'proposed_score_target': session.proposed_score_target,
            'proposed_by': session.proposed_by.username,
            'votes': [u.username for u in session.votes.all()]
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='vote-for-score')
    def vote_for_score(self, request, pk=None):
        session = self.get_object()
        user = request.user

        if not session.proposed_score_target:
            return Response({'error': 'No score proposal is active.'}, status=status.HTTP_400_BAD_REQUEST)

        # Only players in the campaign can vote
        if not session.campaign.players.filter(id=user.id).exists() and session.campaign.gm != user:
            return Response({'error': 'You must be a player or GM in this campaign to vote.'}, status=status.HTTP_403_FORBIDDEN)

        if user not in session.votes.all():
            session.votes.add(user)
            session.save()

        return Response({
            'message': f'You voted for "{session.proposed_score_target}".',
            'proposed_score_target': session.proposed_score_target,
            'proposed_by': session.proposed_by.username,
            'votes': [u.username for u in session.votes.all()]
        }, status=status.HTTP_200_OK)


class ChatMessageViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = ChatMessage.objects.all()
    serializer_class = ChatMessageSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return ChatMessage.objects.all()
        # GMs can see all chat messages in their campaigns
        if Campaign.objects.filter(gm=user).exists():
            return ChatMessage.objects.filter(campaign__gm=user)
        # Players can see chat messages in campaigns they are part of
        return ChatMessage.objects.filter(campaign__players=user).distinct()

    def perform_create(self, serializer):
        campaign = serializer.validated_data.get('campaign')
        if not campaign:
            raise serializers.ValidationError("Campaign is required for a ChatMessage.")
        # Only GM or players of the campaign can create chat messages
        if campaign.gm != self.request.user and not campaign.players.filter(id=self.request.user.id).exists():
            raise PermissionDenied("You are not part of this campaign and cannot create chat messages for it.")
        serializer.save(sender=self.request.user)
