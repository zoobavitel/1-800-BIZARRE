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

        cid = None
        if campaign_id not in (None, ""):
            try:
                cid = int(campaign_id)
            except (TypeError, ValueError):
                cid = None

        if user.is_staff:
            base = qs
        else:
            vis = (
                models.Q(scope="TEMPLATE")
                | models.Q(scope="SITE")
                | models.Q(campaign__gm=user)
                | models.Q(campaign__characters__user=user)
            )
            if cid:
                vis = models.Q(scope="TEMPLATE") | models.Q(scope="SITE") | (
                    models.Q(scope="CAMPAIGN", campaign_id=cid)
                    & (
                        models.Q(campaign__gm=user)
                        | models.Q(campaign__characters__user=user)
                    )
                )
            base = qs.filter(vis).distinct()

        if cid:
            base = base.filter(
                models.Q(scope="TEMPLATE")
                | models.Q(scope="SITE")
                | models.Q(scope="CAMPAIGN", campaign_id=cid)
            )
        elif getattr(self, "action", None) == "list":
            # Unscoped list is the global catalog: never leak campaign libraries.
            base = base.filter(scope__in=("TEMPLATE", "SITE"))
        elif not user.is_staff:
            # Detail/update/publish: GM/player may still fetch their campaign rows by id.
            base = base.filter(
                models.Q(scope="TEMPLATE")
                | models.Q(scope="SITE")
                | models.Q(campaign__gm=user)
                | models.Q(campaign__characters__user=user)
            ).distinct()

        if scope:
            base = base.filter(scope=str(scope).upper())

        if available_only:
            if not cid:
                return EquipmentItem.objects.none()
            access = CampaignEquipmentAccess.objects.filter(campaign_id=cid)
            disabled_template_ids = access.filter(enabled=False).values_list(
                "item_id", flat=True
            )
            enabled_site_ids = access.filter(enabled=True).values_list(
                "item_id", flat=True
            )
            base = base.filter(
                (
                    models.Q(scope="TEMPLATE")
                    & ~models.Q(id__in=disabled_template_ids)
                )
                | models.Q(scope="SITE", id__in=enabled_site_ids)
                | models.Q(
                    scope="CAMPAIGN",
                    campaign_id=cid,
                    available_when_adding=True,
                )
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

    def _can_edit_catalog_item(self, request, instance):
        """Creator, campaign GM (CAMPAIGN), or staff. TEMPLATE is staff-only."""
        if request.user.is_staff:
            return True
        if instance.scope == "TEMPLATE":
            return False
        if instance.created_by_id and instance.created_by_id == request.user.id:
            return True
        if instance.scope == "CAMPAIGN" and instance.campaign_id:
            return instance.campaign.gm_id == request.user.id
        return False

    def perform_update(self, serializer):
        instance = self.get_object()
        if not self._can_edit_catalog_item(self.request, instance):
            self.permission_denied(
                self.request,
                message="Only the item creator, campaign GM, or staff can edit this catalog entry.",
            )
        serializer.save()

    def perform_destroy(self, instance):
        if not self._can_edit_catalog_item(self.request, instance):
            self.permission_denied(
                self.request,
                message="Only the item creator, campaign GM, or staff can delete this catalog entry.",
            )
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
        existing = (
            EquipmentItem.objects.filter(
                scope__in=("TEMPLATE", "SITE"),
                name__iexact=item.name,
            )
            .order_by("id")
            .first()
        )
        if existing:
            return Response(
                EquipmentItemSerializer(
                    existing, context=self.get_serializer_context()
                ).data
            )
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
        existing = (
            EquipmentItem.objects.filter(name__iexact=name)
            .filter(
                models.Q(scope="CAMPAIGN", campaign=campaign)
                | models.Q(scope__in=("TEMPLATE", "SITE"))
            )
            .order_by("id")
            .first()
        )
        if existing:
            return Response(
                EquipmentItemSerializer(
                    existing, context=self.get_serializer_context()
                ).data
            )
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
