from django.db import models
from django.contrib.auth.models import User
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Campaign, CampaignInvitation, Character
from ..serializers import CampaignSerializer, CampaignInvitationSerializer


class CampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Campaign.objects.all()
        return Campaign.objects.filter(
            models.Q(gm=user) | models.Q(characters__user=user) | models.Q(players=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(gm=self.request.user)

    def update(self, request, *args, **kwargs):
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {'error': 'Only the GM can update this campaign'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {'error': 'Only the GM can update this campaign'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='invite')
    def invite_player(self, request, pk=None):
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response({'error': 'Only the GM can invite players.'}, status=status.HTTP_403_FORBIDDEN)

        username = request.data.get('username', '').strip()
        if not username:
            return Response({'error': 'Username is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invited_user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'error': f'User "{username}" not found.'}, status=status.HTTP_404_NOT_FOUND)

        if invited_user == campaign.gm:
            return Response({'error': 'Cannot invite the GM to their own campaign.'}, status=status.HTTP_400_BAD_REQUEST)

        if campaign.players.filter(id=invited_user.id).exists():
            return Response({'error': f'{username} is already in this campaign.'}, status=status.HTTP_400_BAD_REQUEST)

        existing = CampaignInvitation.objects.filter(
            campaign=campaign, invited_user=invited_user, status='pending'
        ).first()
        if existing:
            return Response({'error': f'{username} already has a pending invitation.'}, status=status.HTTP_400_BAD_REQUEST)

        invitation = CampaignInvitation.objects.create(
            campaign=campaign, invited_user=invited_user, invited_by=request.user
        )
        return Response(CampaignInvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response({'error': 'Only the GM can deactivate this campaign.'}, status=status.HTTP_403_FORBIDDEN)
        campaign.is_active = False
        campaign.save(update_fields=['is_active'])
        return Response({'status': 'Campaign deactivated.'})

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response({'error': 'Only the GM can activate this campaign.'}, status=status.HTTP_403_FORBIDDEN)
        campaign.is_active = True
        campaign.save(update_fields=['is_active'])
        return Response({'status': 'Campaign activated.'})

    @action(detail=True, methods=['post'], url_path='assign-character')
    def assign_character(self, request, pk=None):
        campaign = self.get_object()
        character_id = request.data.get('character_id')
        if not character_id:
            return Response({'error': 'character_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            character = Character.objects.get(id=character_id, user=request.user)
        except Character.DoesNotExist:
            return Response({'error': 'Character not found or not owned by you.'}, status=status.HTTP_404_NOT_FOUND)

        if not campaign.players.filter(id=request.user.id).exists() and campaign.gm != request.user:
            return Response({'error': 'You must be a member of this campaign.'}, status=status.HTTP_403_FORBIDDEN)

        character.campaign = campaign
        character.save(update_fields=['campaign'])
        if not campaign.players.filter(id=request.user.id).exists():
            campaign.players.add(request.user)
        return Response({'status': f'Character "{character.true_name}" assigned to campaign.'})

    @action(detail=True, methods=['post'], url_path='unassign-character')
    def unassign_character(self, request, pk=None):
        campaign = self.get_object()
        character_id = request.data.get('character_id')
        if not character_id:
            return Response({'error': 'character_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            character = Character.objects.get(id=character_id, user=request.user, campaign=campaign)
        except Character.DoesNotExist:
            return Response({'error': 'Character not found in this campaign.'}, status=status.HTTP_404_NOT_FOUND)

        character.campaign = None
        character.save(update_fields=['campaign'])
        remaining = Character.objects.filter(campaign=campaign, user=request.user).exists()
        if not remaining and request.user != campaign.gm:
            campaign.players.remove(request.user)
        return Response({'status': f'Character "{character.true_name}" removed from campaign.'})


class CampaignInvitationViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CampaignInvitationSerializer

    def get_queryset(self):
        return CampaignInvitation.objects.filter(
            invited_user=self.request.user, status='pending'
        ).select_related('campaign', 'invited_by', 'invited_user')

    def list(self, request):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept(self, request, pk=None):
        try:
            invitation = CampaignInvitation.objects.get(
                id=pk, invited_user=request.user, status='pending'
            )
        except CampaignInvitation.DoesNotExist:
            return Response({'error': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)

        invitation.status = 'accepted'
        invitation.save(update_fields=['status'])
        invitation.campaign.players.add(request.user)
        return Response({'status': 'Invitation accepted.'})

    @action(detail=True, methods=['post'], url_path='decline')
    def decline(self, request, pk=None):
        try:
            invitation = CampaignInvitation.objects.get(
                id=pk, invited_user=request.user, status='pending'
            )
        except CampaignInvitation.DoesNotExist:
            return Response({'error': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)

        invitation.status = 'declined'
        invitation.save(update_fields=['status'])
        return Response({'status': 'Invitation declined.'}) 