from django.db import models
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from ..models import (
    Claim, CrewSpecialAbility, CrewPlaybook, CrewUpgrade,
    Character, XPHistory, StressHistory, ChatMessage, ProgressClock,
    CampaignAuditLog,
)


def _log_progress_clock_audit(clock, user, action, extra=None):
    if not clock.campaign_id:
        return
    payload = {
        "clock_id": clock.id,
        "name": clock.name,
        "filled_segments": clock.filled_segments,
        "max_segments": clock.max_segments,
        "visible_to_party": clock.visible_to_party,
        "visible_to_players": clock.visible_to_players,
        "npc_id": clock.npc_id,
        "character_id": clock.character_id,
        "session_id": clock.session_id,
    }
    if extra:
        payload["extra"] = extra
    CampaignAuditLog.objects.create(
        campaign_id=clock.campaign_id,
        actor=user if getattr(user, "is_authenticated", False) else None,
        action=action,
        payload=payload,
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


class XPHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """XP ledger entries; players see own PC, GM sees campaign PCs when ?character= is set."""
    permission_classes = [IsAuthenticated]
    queryset = XPHistory.objects.all()
    serializer_class = XPHistorySerializer

    def get_queryset(self):
        qs = XPHistory.objects.all().select_related('character', 'session', 'character__campaign')
        user = self.request.user
        if user.is_staff:
            return qs
        char_id = self.request.query_params.get('character')
        if char_id:
            char = Character.objects.filter(pk=char_id).select_related('campaign').first()
            if char and (char.user_id == user.id or (char.campaign_id and char.campaign.gm_id == user.id)):
                return qs.filter(character_id=char_id)
            return XPHistory.objects.none()
        return qs.filter(character__user=user)


class StressHistoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = StressHistory.objects.all()
    serializer_class = StressHistorySerializer


class ChatMessageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = ChatMessage.objects.all()
    serializer_class = ChatMessageSerializer


class ProgressClockViewSet(viewsets.ModelViewSet):
    """CRUD for progress clocks. GM and players can create; visibility filter for non-GM."""
    permission_classes = [IsAuthenticated]
    serializer_class = ProgressClockSerializer

    def get_queryset(self):
        from django.db.models import Q
        from ..models import Campaign
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
            if campaign_id:
                try:
                    campaign = Campaign.objects.get(id=campaign_id)
                    if campaign.gm_id != user.id:
                        showcased_npc_ids = list(campaign.showcased_npcs.values_list('npc_id', flat=True))
                        campaign_player_ids = list(campaign.players.values_list('id', flat=True)) + list(
                            campaign.characters.values_list('user_id', flat=True).distinct()
                        )
                        qs = qs.filter(
                            Q(
                                Q(created_by__isnull=True, visible_to_players=True)
                                & (Q(npc__isnull=True) | Q(npc_id__in=showcased_npc_ids))
                            )
                            | Q(created_by_id=user.id)
                            | Q(visible_to_party=True, created_by_id__in=campaign_player_ids)
                        )
                        qs = qs.filter(
                            Q(npc__isnull=True) | Q(npc__campaign_id=campaign_id)
                        )
                except Campaign.DoesNotExist:
                    pass
        return qs

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied

        campaign = serializer.validated_data.get("campaign")
        user = self.request.user
        is_gm = campaign and campaign.gm_id == user.id
        if not campaign and not user.is_staff:
            raise PermissionDenied("Campaign is required to create progress clocks.")
        if campaign and not is_gm and not user.is_staff:
            in_campaign = (
                campaign.players.filter(id=user.id).exists()
                or campaign.characters.filter(user_id=user.id).exists()
            )
            if not in_campaign:
                raise PermissionDenied("Only campaign members can create progress clocks.")
            clock = serializer.save(created_by=user)
        else:
            clock = serializer.save()
        _log_progress_clock_audit(clock, user, "clock_created")

    def perform_update(self, serializer):
        from rest_framework.exceptions import PermissionDenied

        obj = serializer.instance
        user = self.request.user
        is_gm = obj.campaign and obj.campaign.gm_id == user.id
        if not obj.campaign and not user.is_staff:
            raise PermissionDenied("Only staff can update clocks without a campaign.")

        data = serializer.validated_data
        party_tick_keys = frozenset({"filled_segments"})

        if user.is_staff or is_gm:
            pass
        else:
            campaign = obj.campaign
            in_campaign = (
                campaign.players.filter(id=user.id).exists()
                or campaign.characters.filter(user_id=user.id).exists()
            )
            if (
                obj.visible_to_party
                and in_campaign
                and set(data.keys()) <= party_tick_keys
            ):
                pass
            elif obj.created_by_id == user.id:
                if "visible_to_players" in data and data.get(
                    "visible_to_players"
                ) != obj.visible_to_players:
                    raise PermissionDenied(
                        "Only the GM can change visible_to_players."
                    )
            else:
                raise PermissionDenied("Only the creator or GM can update this clock.")

        before = {
            "filled_segments": obj.filled_segments,
            "max_segments": obj.max_segments,
            "name": obj.name,
            "visible_to_party": obj.visible_to_party,
            "visible_to_players": obj.visible_to_players,
            "completed": obj.completed,
        }
        serializer.save()
        _log_progress_clock_audit(serializer.instance, user, "clock_updated", {"before": before})

    def perform_destroy(self, instance):
        from rest_framework.exceptions import PermissionDenied

        user = self.request.user
        is_gm = instance.campaign and instance.campaign.gm_id == user.id
        if not is_gm and not user.is_staff:
            if instance.created_by_id != user.id:
                raise PermissionDenied("Only the creator or GM can delete this clock.")
        if not instance.campaign and not user.is_staff:
            raise PermissionDenied("Only staff can delete clocks without a campaign.")
        snap = {
            "filled_segments": instance.filled_segments,
            "max_segments": instance.max_segments,
            "name": instance.name,
            "clock_id": instance.id,
        }
        _log_progress_clock_audit(instance, user, "clock_deleted", {"before": snap})
        instance.delete()