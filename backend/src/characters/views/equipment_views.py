from django.db import models
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Campaign, Character, EquipmentItem, CampaignEquipmentAccess
from ..serializers import (
    EquipmentItemSerializer,
    CampaignEquipmentAccessSerializer,
)


class EquipmentItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = EquipmentItemSerializer

    def get_queryset(self):
        user = self.request.user
        qs = EquipmentItem.objects.select_related("campaign", "created_by")
        campaign_id = self.request.query_params.get("campaign")
        scope = self.request.query_params.get("scope")
        available_only = self.request.query_params.get("available_for_campaign")

        if user.is_staff:
            base = qs
        else:
            base = qs.filter(
                models.Q(scope="TEMPLATE")
                | models.Q(scope="SITE")
                | models.Q(campaign__gm=user)
                | models.Q(campaign__characters__user=user)
            ).distinct()

        if scope:
            base = base.filter(scope=scope.upper())
        if campaign_id:
            try:
                cid = int(campaign_id)
            except (TypeError, ValueError):
                cid = None
            if cid:
                base = base.filter(
                    models.Q(scope="TEMPLATE")
                    | models.Q(scope="SITE")
                    | models.Q(scope="CAMPAIGN", campaign_id=cid)
                )
        if available_only and campaign_id:
            try:
                cid = int(campaign_id)
            except (TypeError, ValueError):
                cid = None
            if cid:
                disabled_site = CampaignEquipmentAccess.objects.filter(
                    campaign_id=cid, enabled=False
                ).values_list("item_id", flat=True)
                base = base.exclude(
                    models.Q(scope="SITE", id__in=disabled_site)
                ).exclude(
                    models.Q(scope="CAMPAIGN", campaign_id=cid, available_when_adding=False)
                )
        return base.order_by("category", "name")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        campaign_id = self.request.query_params.get("campaign")
        if campaign_id:
            ctx["campaign_id"] = campaign_id
        return ctx

    def _assert_gm(self, request, campaign):
        if request.user.is_staff:
            return
        if campaign.gm_id != request.user.id:
            self.permission_denied(
                request,
                message="Only the campaign GM can manage equipment catalog entries.",
                code="gm_only",
            )

    def perform_create(self, serializer):
        scope = serializer.validated_data.get("scope", "CAMPAIGN")
        campaign = serializer.validated_data.get("campaign")
        if scope == "SITE":
            if not self.request.user.is_staff:
                self.permission_denied(
                    self.request,
                    message="Only staff can create site-wide catalog items.",
                )
        elif scope == "CAMPAIGN":
            self._assert_gm(self.request, campaign)
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.scope == "SITE" and not self.request.user.is_staff:
            self.permission_denied(self.request, message="Site catalog is staff-only.")
        if instance.scope == "CAMPAIGN" and instance.campaign_id:
            self._assert_gm(self.request, instance.campaign)
        serializer.save()

    def perform_destroy(self, instance):
        if instance.scope == "SITE" and not self.request.user.is_staff:
            self.permission_denied(self.request, message="Site catalog is staff-only.")
        if instance.scope == "CAMPAIGN" and instance.campaign_id:
            self._assert_gm(self.request, instance.campaign)
        instance.delete()

    @action(detail=True, methods=["post"], url_path="set-campaign-access")
    def set_campaign_access(self, request, pk=None):
        item = self.get_object()
        campaign_id = request.data.get("campaign")
        enabled = request.data.get("enabled", True)
        try:
            campaign = Campaign.objects.get(pk=campaign_id)
        except (Campaign.DoesNotExist, TypeError, ValueError):
            return Response(
                {"error": "Valid campaign id required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        self._assert_gm(request, campaign)
        if item.scope not in ("TEMPLATE", "SITE"):
            return Response(
                {"error": "Only template or site items use campaign access toggles."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        access, _ = CampaignEquipmentAccess.objects.update_or_create(
            campaign=campaign,
            item=item,
            defaults={"enabled": bool(enabled)},
        )
        return Response(CampaignEquipmentAccessSerializer(access).data)

    @action(detail=True, methods=["post"], url_path="publish-to-site")
    def publish_to_site(self, request, pk=None):
        """GM promotes a campaign item to the site catalog (staff may also use)."""
        item = self.get_object()
        if item.scope == "CAMPAIGN" and item.campaign_id:
            self._assert_gm(request, item.campaign)
        elif not request.user.is_staff:
            self.permission_denied(request, message="GM or staff only.")
        site_item = EquipmentItem.objects.create(
            name=item.name,
            description=item.description,
            category=item.category,
            load_slots=item.load_slots,
            quality=item.quality,
            coin_value=item.coin_value,
            scope="SITE",
            created_by=request.user,
            source_character_id=item.source_character_id,
            available_when_adding=True,
        )
        return Response(
            EquipmentItemSerializer(site_item, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="from-kit-item")
    def from_kit_item(self, request):
        """Create campaign library entry from a player kit row or GM draft."""
        campaign_id = request.data.get("campaign")
        try:
            campaign = Campaign.objects.get(pk=campaign_id)
        except (Campaign.DoesNotExist, TypeError, ValueError):
            return Response(
                {"error": "Valid campaign id required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        self._assert_gm(request, campaign)
        name = str(request.data.get("name") or "").strip()
        if not name:
            return Response({"error": "name is required."}, status=status.HTTP_400_BAD_REQUEST)
        source_character_id = request.data.get("source_character")
        item = EquipmentItem.objects.create(
            name=name,
            description=str(request.data.get("detail") or request.data.get("description") or ""),
            category=str(request.data.get("category") or "other"),
            load_slots=min(2, max(0, int(request.data.get("load", 1) or 1))),
            quality=min(3, max(0, int(request.data.get("quality", 1) or 1))),
            coin_value=request.data.get("coin_value"),
            scope="CAMPAIGN",
            campaign=campaign,
            created_by=request.user,
            source_character_id=source_character_id if source_character_id else None,
            available_when_adding=bool(request.data.get("available_when_adding", True)),
        )
        return Response(
            EquipmentItemSerializer(item, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )
