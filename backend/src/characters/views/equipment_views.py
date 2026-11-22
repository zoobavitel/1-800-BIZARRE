import uuid

from django.db import models, transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from ..models import (
    Campaign,
    CampaignEquipmentAccess,
    Character,
    EquipmentItem,
    HomebrewCollectionEntry,
)
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
        homebrew = self.request.query_params.get("homebrew")
        if homebrew in HOMEBREW_LISTS and getattr(self, "action", None) == "list":
            return self._homebrew_list(user, homebrew)
        if homebrew == "owned" and getattr(self, "action", None) == "list":
            return self._owned_homebrew(user)
        if homebrew == "campaign" and getattr(self, "action", None) == "list":
            return self._campaign_homebrew(user)

        cid = None
        if campaign_id not in (None, ""):
            try:
                cid = int(campaign_id)
            except (TypeError, ValueError):
                cid = None

        # Published homebrew is visible to everyone; a private item only to
        # its creator. Staff get no exception (2026-11-08).
        shared_vis = models.Q(scope="SHARED", is_public=True) | models.Q(
            scope="SHARED", created_by=user
        )

        vis = (
            models.Q(scope="TEMPLATE")
            | models.Q(scope="SITE")
            | shared_vis
            | models.Q(campaign__gm=user)
            | models.Q(campaign__characters__user=user)
        )
        if cid:
            vis = models.Q(scope="TEMPLATE") | models.Q(scope="SITE") | shared_vis | (
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
                | models.Q(scope="SHARED", is_public=True)
                | models.Q(scope="CAMPAIGN", campaign_id=cid)
            )
        elif getattr(self, "action", None) == "list":
            # Unscoped list is the global catalog: never leak campaign libraries.
            base = base.filter(scope__in=("TEMPLATE", "SITE", "SHARED"))
        else:
            # Detail/update/share: GM/player may still fetch their campaign rows by id.
            base = base.filter(
                models.Q(scope="TEMPLATE")
                | models.Q(scope="SITE")
                | shared_vis
                | models.Q(campaign__gm=user)
                | models.Q(campaign__characters__user=user)
            ).distinct()

        if scope:
            base = base.filter(scope=str(scope).upper())
        if self.request.query_params.get("mine"):
            base = base.filter(created_by=user)

        if available_only:
            if not cid:
                return EquipmentItem.objects.none()
            access = CampaignEquipmentAccess.objects.filter(campaign_id=cid)
            disabled_template_ids = access.filter(enabled=False).values_list(
                "item_id", flat=True
            )
            # Add Item is SRD plus the campaign library. Homebrew (SITE and
            # SHARED) has its own picker, ?homebrew=owned (S10).
            base = base.filter(
                (
                    models.Q(scope="TEMPLATE")
                    & ~models.Q(id__in=disabled_template_ids)
                )
                | models.Q(
                    scope="CAMPAIGN",
                    campaign_id=cid,
                    available_when_adding=True,
                )
            )
        return base.order_by("category", "name")

    def _homebrew_list(self, user, which):
        """Homebrew page lists (S9). Published homebrew is SITE (staff-made)
        or public SHARED; mine is my SITE/SHARED rows, private or not."""
        published = models.Q(scope="SITE") | models.Q(scope="SHARED", is_public=True)
        qs = EquipmentItem.objects.select_related("created_by")
        if which == "browse":
            qs = qs.filter(published)
            q = str(self.request.query_params.get("q") or "").strip()
            if q:
                qs = qs.filter(models.Q(name__icontains=q) | models.Q(description__icontains=q))
        elif which == "mine":
            qs = qs.filter(scope__in=("SITE", "SHARED"), created_by=user)
        else:  # collection: hide items their creator unpublished since
            qs = qs.filter(collected_by__user=user).filter(
                published | models.Q(scope="SHARED", created_by=user)
            )
        return qs.distinct().order_by("name")

    @staticmethod
    def _campaign_members(campaign):
        """GM, invited players, and owners of the campaign's characters."""
        ids = set(campaign.players.values_list("id", flat=True))
        ids |= set(
            Character.objects.filter(campaign=campaign, user__isnull=False).values_list("user_id", flat=True)
        )
        ids.add(campaign.gm_id)
        return ids

    @staticmethod
    def _homebrew_of(user_ids):
        """Homebrew these users made (private or published) or saved to their
        collection (published, or made by one of them)."""
        published = models.Q(scope="SITE") | models.Q(scope="SHARED", is_public=True)
        made = models.Q(scope__in=("SITE", "SHARED"), created_by_id__in=user_ids)
        saved = models.Q(scope__in=("SITE", "SHARED"), collected_by__user_id__in=user_ids) & (
            published | models.Q(created_by_id__in=user_ids)
        )
        return set(EquipmentItem.objects.filter(made | saved).values_list("id", flat=True))

    def _owned_homebrew(self, user):
        """The sheet's "Add owned homebrew item" list.

        Like D&D Beyond's campaign content sharing (user's rule, 2026-11-08):
        with the campaign's switch on, everyone in it shares one pool, the
        homebrew any member made or saved. No site-wide catalog and no block
        list; the table agrees what to use. A sheet with no campaign gets its
        owner's own homebrew when its own switch is on. The sheet's owner
        or its GM may read it."""
        try:
            character = Character.objects.select_related("campaign").get(
                pk=self.request.query_params.get("character")
            )
        except (Character.DoesNotExist, TypeError, ValueError):
            raise NotFound("Character not found.")
        campaign = character.campaign
        if not (
            character.user_id == user.id
            or (campaign is not None and campaign.gm_id == user.id)
        ):
            raise PermissionDenied("Only the sheet's owner or GM can see its homebrew.")

        switch_on = campaign.homebrew_enabled if campaign is not None else character.homebrew_enabled
        owner_ids = self._homebrew_of({character.user_id}) if character.user_id else set()
        self._homebrew_owner_ids = owner_ids
        if not switch_on:
            return EquipmentItem.objects.none()
        ids = owner_ids
        if campaign is not None:
            ids = ids | self._homebrew_of(self._campaign_members(campaign))
        return EquipmentItem.objects.select_related("created_by").filter(id__in=ids).order_by("name")

    def _campaign_homebrew(self, user):
        """The campaign's shared pool, for the GM's Equipment catalog card.
        Members only (GM, players, staff)."""
        try:
            campaign = Campaign.objects.get(pk=self.request.query_params.get("campaign"))
        except (Campaign.DoesNotExist, TypeError, ValueError):
            raise NotFound("Campaign not found.")
        members = self._campaign_members(campaign)
        if user.id not in members:
            raise PermissionDenied("Only the campaign's members can see its homebrew.")
        return (
            EquipmentItem.objects.select_related("created_by")
            .filter(id__in=self._homebrew_of(members))
            .order_by("name")
        )

    @action(detail=True, methods=["post"], url_path="add-to-character")
    def add_to_character(self, request, pk=None):
        """Put a homebrew item on one of your own sheets (S10). The item must
        be yours, in your collection, or published."""
        try:
            character_id = int(request.data.get("character"))
        except (TypeError, ValueError):
            raise ValidationError({"character": ["A character id is required."]})
        # The sheet's owner first, so a stranger learns nothing about the item.
        owner_id = Character.objects.filter(pk=character_id).values_list("user_id", flat=True).first()
        if owner_id is None and not Character.objects.filter(pk=character_id).exists():
            raise NotFound("Character not found.")
        if owner_id != request.user.id:
            self.permission_denied(request, message="You can only add items to your own sheet.")
        item = self._collectable(request)
        with transaction.atomic():
            character = Character.objects.select_for_update().get(pk=character_id)
            row = {
                "id": str(uuid.uuid4()),
                "name": item.name,
                "detail": item.description or "",
                "category": item.category or "other",
                "load": item.load_slots,
                "quality": item.quality,
                "coin_value": item.coin_value,
                "catalog_id": item.id,
                "is_armor": False,
                "armor_kind": "",
            }
            inventory = character.inventory if isinstance(character.inventory, list) else []
            character.inventory = [*inventory, row]
            character.save(update_fields=["inventory"])
        return Response({"character": character.id, "row": row})

    @action(detail=True, methods=["post"], url_path="collect")
    def collect(self, request, pk=None):
        item = self._collectable(request)
        HomebrewCollectionEntry.objects.get_or_create(user=request.user, item=item)
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=["post"], url_path="uncollect")
    def uncollect(self, request, pk=None):
        item = self.get_object()
        HomebrewCollectionEntry.objects.filter(user=request.user, item=item).delete()
        return Response(self.get_serializer(item).data)

    def _collectable(self, request):
        item = self.get_object()
        if item.scope not in ("SITE", "SHARED"):
            raise ValidationError({"scope": ["Only homebrew items go in a collection."]})
        if item.scope == "SHARED" and not item.is_public and item.created_by_id != request.user.id:
            self.permission_denied(request, message="That homebrew item is private.")
        return item

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if hasattr(self, "_homebrew_owner_ids"):
            ctx["homebrew_owner_ids"] = self._homebrew_owner_ids
        campaign_id = self.request.query_params.get("campaign")
        if campaign_id:
            ctx["campaign_id"] = campaign_id
        return ctx

    def _assert_gm(self, request, campaign):
        if campaign.gm_id != request.user.id:
            self.permission_denied(
                request,
                message="Only the campaign GM can manage equipment catalog entries.",
                code="gm_only",
            )

    def _assert_may_place(self, request, scope, campaign):
        """Who may put an item at this scope (S7). SITE and TEMPLATE items show
        in every campaign, so only staff place them; a CAMPAIGN item needs that
        campaign's GM. Checked on create and whenever an edit changes scope or
        campaign."""
        if scope in ("SITE", "TEMPLATE"):
            if not request.user.is_staff:
                self.permission_denied(
                    request,
                    message="Only staff can create or move items into the shared catalog.",
                )
        elif scope == "SHARED":
            self.permission_denied(
                request,
                message="Use share to make an item public.",
            )
        elif scope == "CAMPAIGN":
            if campaign is None:
                raise ValidationError({"campaign": ["A campaign item needs a campaign."]})
            self._assert_gm(request, campaign)

    def perform_create(self, serializer):
        scope = serializer.validated_data.get("scope", "CAMPAIGN")
        campaign = serializer.validated_data.get("campaign")
        self._assert_may_place(self.request, scope, campaign)
        serializer.save(created_by=self.request.user)

    def _can_edit_catalog_item(self, request, instance):
        """Creator or campaign GM (CAMPAIGN). The SRD catalog (TEMPLATE, SITE)
        is staff-only; staff get nothing else (2026-11-08)."""
        if instance.scope in ("TEMPLATE", "SITE"):
            return bool(request.user.is_staff)
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
                message="Only staff can edit core catalog items. Campaign items: the creator, the campaign GM, or staff.",
            )
        data = serializer.validated_data
        scope = data.get("scope", instance.scope)
        campaign = data["campaign"] if "campaign" in data else instance.campaign
        if scope != instance.scope or campaign != instance.campaign:
            self._assert_may_place(self.request, scope, campaign)
        serializer.save()

    def perform_destroy(self, instance):
        if instance.scope == "SHARED":
            # Homebrew is unpublished, not deleted, on the site; Django admin
            # can delete it.
            self.permission_denied(
                self.request,
                message="Unpublish homebrew instead of deleting it.",
            )
        if not self._can_edit_catalog_item(self.request, instance):
            self.permission_denied(
                self.request,
                message="Only staff can delete core catalog items. Campaign items: the creator, the campaign GM, or staff.",
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
        # SRD templates only. Homebrew reaches a campaign through its shared
        # pool when Enable homebrew is on (S11), not per item.
        if item.scope != "TEMPLATE":
            return Response(
                {"error": "Only SRD template items use campaign access toggles."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        access, _ = CampaignEquipmentAccess.objects.update_or_create(
            campaign=campaign,
            item=item,
            defaults={"enabled": _truthy(enabled)},
        )
        return Response(CampaignEquipmentAccessSerializer(access).data)

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
        if source_character_id and not Character.objects.filter(
            pk=source_character_id, campaign=campaign
        ).exists():
            return Response(
                {"source_character": ["Must be a character in this campaign."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
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

    # Public (shared) items, story S8 (user's rules, 2026-11-06).

    def _shared_response(self, item, created):
        return Response(
            EquipmentItemSerializer(item, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="share")
    def share(self, request):
        """Make homebrew (S8). Sources, in order:

        - item: one of your campaign library items.
        - template: an SRD item or public homebrew item to start from; the
          body's own fields override its fields. The template is unchanged.
        - source_character: a custom item from your own sheet.
        - none: an item from scratch (the Homebrew page's Create form).

        public (default true) publishes it; false saves it as private
        homebrew. Saving an item you already have never unpublishes it.
        """
        user = request.user
        public = _truthy(request.data.get("public", True))
        library_id = request.data.get("item")
        template_id = request.data.get("template")
        character_id = request.data.get("source_character")
        overrides = self._homebrew_fields_from_body(request.data)
        if library_id not in (None, ""):
            source = (
                EquipmentItem.objects.select_related("campaign")
                .filter(pk=library_id, scope="CAMPAIGN")
                .first()
            )
            if source is None:
                return Response({"error": "Campaign item not found."}, status=status.HTTP_404_NOT_FOUND)
            if not (
                source.created_by_id == user.id
                or (source.campaign_id and source.campaign.gm_id == user.id)
            ):
                self.permission_denied(request, message="You can only share your own items.")
            fields = self._homebrew_fields_from_item(source)
        elif template_id not in (None, ""):
            source = (
                EquipmentItem.objects.filter(pk=template_id)
                .filter(
                    models.Q(scope__in=("TEMPLATE", "SITE"))
                    | models.Q(scope="SHARED", is_public=True)
                    | models.Q(scope="SHARED", created_by=user)
                )
                .first()
            )
            if source is None:
                return Response({"error": "Template not found."}, status=status.HTTP_404_NOT_FOUND)
            fields = self._homebrew_fields_from_item(source)
            fields["source_character_id"] = None
            fields.update(overrides)
        elif character_id not in (None, ""):
            try:
                character = Character.objects.get(pk=character_id)
            except (Character.DoesNotExist, TypeError, ValueError):
                return Response(
                    {"source_character": ["Your character is required."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if character.user_id != user.id:
                self.permission_denied(request, message="You can only share items from your own sheet.")
            fields = {
                "name": "", "description": "", "category": "other",
                "load_slots": 1, "quality": 1, "coin_value": None,
                **overrides,
                "source_character_id": character.id,
            }
        else:
            fields = {
                "name": "", "description": "", "category": "other",
                "load_slots": 1, "quality": 1, "coin_value": None,
                **overrides,
                "source_character_id": None,
            }
        fields["name"] = str(fields.get("name") or "").strip()
        if not fields["name"]:
            return Response({"error": "name is required."}, status=status.HTTP_400_BAD_REQUEST)
        valid_categories = {value for value, _ in EquipmentItem.CATEGORY_CHOICES}
        if fields["category"] not in valid_categories:
            fields["category"] = "other"

        existing = (
            EquipmentItem.objects.filter(scope="SHARED", created_by=user, name__iexact=fields["name"])
            .order_by("id")
            .first()
        )
        if existing:
            if public and not existing.is_public:
                existing.is_public = True
                existing.save(update_fields=["is_public"])
            return self._shared_response(existing, created=False)
        item = EquipmentItem.objects.create(scope="SHARED", is_public=public, created_by=user, **fields)
        return self._shared_response(item, created=True)

    @staticmethod
    def _homebrew_fields_from_item(source):
        return {
            "name": source.name,
            "description": source.description,
            "category": source.category,
            "load_slots": source.load_slots,
            "quality": source.quality,
            "coin_value": source.coin_value,
            "source_character_id": source.source_character_id,
        }

    @staticmethod
    def _homebrew_fields_from_body(data):
        """Only the fields the body sends, so a template's fields fill the rest."""
        fields = {}
        if "name" in data:
            fields["name"] = str(data.get("name") or "")
        if "detail" in data or "description" in data:
            fields["description"] = str(data.get("detail") or data.get("description") or "")
        if "category" in data:
            fields["category"] = str(data.get("category") or "other")
        if "load" in data or "load_slots" in data:
            fields["load_slots"] = _bounded_int(data.get("load", data.get("load_slots")), 0, 2, 1)
        if "quality" in data:
            fields["quality"] = _bounded_int(data.get("quality"), 0, 3, 1)
        if "coin_value" in data:
            fields["coin_value"] = data.get("coin_value")
        return fields

    def _assert_shared_owner(self, request, item):
        if item.created_by_id != request.user.id:
            # Publishing on someone's behalf is a Django admin action.
            self.permission_denied(request, message="Only the item's creator can do this.")
        if item.scope != "SHARED":
            raise ValidationError({"scope": ["Only shared items can be shared or unshared."]})

    @action(detail=True, methods=["post"], url_path="unpublish")
    def unpublish(self, request, pk=None):
        return self.unshare(request, pk)

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        return self.reshare(request, pk)

    @action(detail=True, methods=["post"], url_path="unshare")
    def unshare(self, request, pk=None):
        """Hide a public item from new adds everywhere. The row stays, so
        copies already on sheets keep pointing at it."""
        item = self.get_object()
        self._assert_shared_owner(request, item)
        item.is_public = False
        item.save(update_fields=["is_public"])
        return self._shared_response(item, created=False)

    @action(detail=True, methods=["post"], url_path="reshare")
    def reshare(self, request, pk=None):
        item = self.get_object()
        self._assert_shared_owner(request, item)
        item.is_public = True
        item.save(update_fields=["is_public"])
        return self._shared_response(item, created=False)

    @action(detail=True, methods=["post"], url_path="copy-to-campaign")
    def copy_to_campaign(self, request, pk=None):
        """A GM's edit of someone else's homebrew: copy it into their own
        campaign library to change it there. The original is untouched. The
        item must be published, or in this campaign's shared pool."""
        item = self.get_object()
        try:
            campaign = Campaign.objects.get(pk=request.data.get("campaign"))
        except (Campaign.DoesNotExist, TypeError, ValueError):
            return Response({"error": "Valid campaign id required."}, status=status.HTTP_400_BAD_REQUEST)
        self._assert_gm(request, campaign)
        if item.scope != "SHARED":
            raise ValidationError({"scope": ["Only homebrew items can be copied."]})
        if not (item.is_public or item.created_by_id in self._campaign_members(campaign)):
            raise ValidationError({"scope": ["Only published homebrew, or a campaign member's, can be copied."]})
        copy = EquipmentItem.objects.create(
            name=item.name,
            description=item.description,
            category=item.category,
            load_slots=item.load_slots,
            quality=item.quality,
            coin_value=item.coin_value,
            scope="CAMPAIGN",
            campaign=campaign,
            created_by=request.user,
            available_when_adding=True,
        )
        return self._shared_response(copy, created=True)


HOMEBREW_LISTS = ("browse", "mine", "collection")


def _truthy(value):
    """JSON true/false, or form strings like "false" and "0"."""
    if isinstance(value, str):
        return value.strip().lower() not in ("", "0", "false", "no", "off")
    return bool(value)


def _bounded_int(value, low, high, default):
    """Parse an int and clamp it. Blank or invalid gives the default; 0 stays 0."""
    if value in (None, ""):
        return default
    try:
        return min(high, max(low, int(value)))
    except (TypeError, ValueError):
        return default
