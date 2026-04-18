from django.db import connection, models
from django.contrib.auth.models import User
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import (
    Campaign,
    CampaignAuditLog,
    CampaignInvitation,
    Character,
    CharacterHistory,
    NPC,
    ShowcasedNPC,
)
from ..serializers import (
    CampaignSerializer,
    CampaignInvitationSerializer,
    ShowcasedNPCSerializer,
    InvitableUserSerializer,
)


def _gm_history_character_row(h):
    changed = h.changed_fields or {}
    keys = sorted(changed.keys())
    label = ", ".join(keys[:14])
    if len(keys) > 14:
        label += "…"
    return {
        "type": "character",
        "timestamp": h.timestamp.isoformat(),
        "id": h.id,
        "character_id": h.character_id,
        "character_name": h.character.true_name,
        "actor_username": h.editor.username if h.editor_id else None,
        "summary": f"Sheet: {label or 'update'}",
        "detail": {"changed_fields": changed},
    }


def _gm_history_clock_row(a):
    payload = a.payload or {}
    cname = payload.get("name") or "Clock"
    verb = a.action.replace("_", " ")
    return {
        "type": "clock",
        "timestamp": a.timestamp.isoformat(),
        "id": a.id,
        "character_id": None,
        "character_name": None,
        "actor_username": a.actor.username if a.actor_id else None,
        "summary": f"Clock {verb}: {cname}",
        "detail": payload,
    }


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
                {"error": "Only the GM can update this campaign"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {"error": "Only the GM can update this campaign"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="invite")
    def invite_player(self, request, pk=None):
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {"error": "Only the GM can invite players."},
                status=status.HTTP_403_FORBIDDEN,
            )

        username = request.data.get("username", "").strip()
        if not username:
            return Response(
                {"error": "Username is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            invited_user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {"error": f'User "{username}" not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invited_user == campaign.gm:
            return Response(
                {"error": "Cannot invite the GM to their own campaign."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if campaign.players.filter(id=invited_user.id).exists():
            return Response(
                {"error": f"{username} is already in this campaign."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = CampaignInvitation.objects.filter(
            campaign=campaign, invited_user=invited_user, status="pending"
        ).first()
        if existing:
            return Response(
                {"error": f"{username} already has a pending invitation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invitation = CampaignInvitation.objects.create(
            campaign=campaign, invited_user=invited_user, invited_by=request.user
        )
        return Response(
            CampaignInvitationSerializer(invitation).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="invitable-users")
    def invitable_users(self, request, pk=None):
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {"error": "Only the GM can view invitable users."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = User.objects.all().order_by("username")

        # Exclude GM
        queryset = queryset.exclude(id=campaign.gm_id)
        # Exclude current players
        queryset = queryset.exclude(
            id__in=campaign.players.values_list("id", flat=True)
        )
        # Exclude users with pending invitations
        pending_user_ids = CampaignInvitation.objects.filter(
            campaign=campaign, status="pending"
        ).values_list("invited_user_id", flat=True)
        queryset = queryset.exclude(id__in=pending_user_ids)

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(username__icontains=search)

        serializer = InvitableUserSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {"error": "Only the GM can deactivate this campaign."},
                status=status.HTTP_403_FORBIDDEN,
            )
        campaign.is_active = False
        campaign.save(update_fields=["is_active"])
        return Response({"status": "Campaign deactivated."})

    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {"error": "Only the GM can activate this campaign."},
                status=status.HTTP_403_FORBIDDEN,
            )
        campaign.is_active = True
        campaign.save(update_fields=["is_active"])
        return Response({"status": "Campaign activated."})

    @action(detail=True, methods=["post"], url_path="assign-character")
    def assign_character(self, request, pk=None):
        campaign = self.get_object()
        character_id = request.data.get("character_id")
        if not character_id:
            return Response(
                {"error": "character_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            character = Character.objects.get(id=character_id, user=request.user)
        except Character.DoesNotExist:
            return Response(
                {"error": "Character not found or not owned by you."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if (
            not campaign.players.filter(id=request.user.id).exists()
            and campaign.gm != request.user
        ):
            return Response(
                {"error": "You must be a member of this campaign."},
                status=status.HTTP_403_FORBIDDEN,
            )

        character.campaign = campaign
        character.save(update_fields=["campaign"])
        if not campaign.players.filter(id=request.user.id).exists():
            campaign.players.add(request.user)

        # Auto-assign character to the campaign's crew if there is exactly one
        campaign_crews = list(campaign.crews.all())
        if len(campaign_crews) == 1 and character.crew_id is None:
            character.crew = campaign_crews[0]
            character.save(update_fields=["crew"])

        return Response(
            {"status": f'Character "{character.true_name}" assigned to campaign.'}
        )

    @action(detail=True, methods=["post"], url_path="unassign-character")
    def unassign_character(self, request, pk=None):
        campaign = self.get_object()
        character_id = request.data.get("character_id")
        if not character_id:
            return Response(
                {"error": "character_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            character = Character.objects.get(
                id=character_id, user=request.user, campaign=campaign
            )
        except Character.DoesNotExist:
            return Response(
                {"error": "Character not found in this campaign."},
                status=status.HTTP_404_NOT_FOUND,
            )

        character.campaign = None
        character.save(update_fields=["campaign"])
        remaining = Character.objects.filter(
            campaign=campaign, user=request.user
        ).exists()
        if not remaining and request.user != campaign.gm:
            campaign.players.remove(request.user)
        return Response(
            {"status": f'Character "{character.true_name}" removed from campaign.'}
        )

    @action(detail=True, methods=["post"], url_path="showcase-npc")
    def showcase_npc(self, request, pk=None):
        """Add an NPC to the campaign showcase (opposition in Entanglement/All-Out-Brawl)."""
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {"error": "Only the GM can add NPCs to the showcase."},
                status=status.HTTP_403_FORBIDDEN,
            )

        npc_id = request.data.get("npc_id")
        if not npc_id:
            return Response(
                {"error": "npc_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            npc = NPC.objects.get(id=npc_id, campaign=campaign)
        except NPC.DoesNotExist:
            return Response(
                {"error": "NPC not found or not in this campaign."},
                status=status.HTTP_404_NOT_FOUND,
            )

        showcased, created = ShowcasedNPC.objects.get_or_create(
            campaign=campaign, npc=npc
        )
        return Response(
            ShowcasedNPCSerializer(showcased).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="gm-history")
    def gm_history(self, request, pk=None):
        """Merged character sheet + progress-clock audit for the GM (paginated)."""
        campaign = self.get_object()
        if campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {"error": "Only the GM can view campaign history."},
                status=status.HTTP_403_FORBIDDEN,
            )

        character_id = request.query_params.get("character")
        character_filter_id = None
        if character_id not in (None, ""):
            try:
                character_filter_id = int(character_id)
            except (TypeError, ValueError):
                character_filter_id = None

        kind = (request.query_params.get("kind") or "all").lower()
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 50))))
        except ValueError:
            page, page_size = 1, 50

        start = (page - 1) * page_size

        ch_qs = CharacterHistory.objects.filter(character__campaign=campaign)
        if character_filter_id is not None:
            ch_qs = ch_qs.filter(character_id=character_filter_id)
        aud_qs = CampaignAuditLog.objects.filter(campaign=campaign)

        if kind == "sheet":
            total = ch_qs.count()
            page_qs = (
                ch_qs.select_related("character", "editor")
                .order_by("-timestamp")[start : start + page_size]
            )
            page_rows = [_gm_history_character_row(h) for h in page_qs]
        elif kind == "clocks":
            total = aud_qs.count()
            page_qs = aud_qs.select_related("actor").order_by("-timestamp")[
                start : start + page_size
            ]
            page_rows = [_gm_history_clock_row(a) for a in page_qs]
        elif kind == "all":
            # Merge by timestamp across both sources; LIMIT/OFFSET on UNION (not a 400-row cap).
            qn = connection.ops.quote_name
            ch_tbl = qn(CharacterHistory._meta.db_table)
            char_tbl = qn(Character._meta.db_table)
            aud_tbl = qn(CampaignAuditLog._meta.db_table)

            part_ch = (
                f"SELECT 'character' AS row_type, ch.id AS row_id, ch.timestamp AS ts "
                f"FROM {ch_tbl} ch "
                f"INNER JOIN {char_tbl} c ON ch.character_id = c.id "
                f"WHERE c.campaign_id = %s"
            )
            union_params = [campaign.id]
            if character_filter_id is not None:
                part_ch += " AND ch.character_id = %s"
                union_params.append(character_filter_id)

            part_aud = (
                f"SELECT 'clock' AS row_type, aud.id AS row_id, aud.timestamp AS ts "
                f"FROM {aud_tbl} aud "
                f"WHERE aud.campaign_id = %s"
            )
            union_params.append(campaign.id)

            inner_union = f"({part_ch}) UNION ALL ({part_aud})"
            count_sql = f"SELECT COUNT(*) FROM ({inner_union}) AS merged_count"
            page_sql = (
                f"SELECT row_type, row_id, ts FROM ({inner_union}) AS merged "
                f"ORDER BY ts DESC LIMIT %s OFFSET %s"
            )

            with connection.cursor() as cursor:
                cursor.execute(count_sql, union_params)
                total = cursor.fetchone()[0]
                cursor.execute(
                    page_sql, union_params + [page_size, start]
                )
                merged_rows = cursor.fetchall()

            char_ids = [rid for rt, rid, _ts in merged_rows if rt == "character"]
            clock_ids = [rid for rt, rid, _ts in merged_rows if rt == "clock"]

            hist_by_id = {
                h.id: h
                for h in CharacterHistory.objects.filter(id__in=char_ids).select_related(
                    "character", "editor"
                )
            }
            aud_by_id = {
                a.id: a
                for a in CampaignAuditLog.objects.filter(id__in=clock_ids).select_related(
                    "actor"
                )
            }

            page_rows = []
            for row_type, row_id, _ts in merged_rows:
                if row_type == "character":
                    h = hist_by_id.get(row_id)
                    if h:
                        page_rows.append(_gm_history_character_row(h))
                else:
                    a = aud_by_id.get(row_id)
                    if a:
                        page_rows.append(_gm_history_clock_row(a))
        else:
            total = 0
            page_rows = []

        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "results": page_rows,
            }
        )


class ShowcasedNPCViewSet(viewsets.ModelViewSet):
    """CRUD for showcased NPCs - GM can update reveal flags and remove from showcase."""

    permission_classes = [IsAuthenticated]
    serializer_class = ShowcasedNPCSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return ShowcasedNPC.objects.all()
        return ShowcasedNPC.objects.filter(campaign__gm=user)

    def partial_update(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {"error": "Only the GM can update showcased NPCs."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.campaign.gm != request.user and not request.user.is_staff:
            return Response(
                {"error": "Only the GM can remove showcased NPCs."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)


class CampaignInvitationViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CampaignInvitationSerializer

    def get_queryset(self):
        return CampaignInvitation.objects.filter(
            invited_user=self.request.user, status="pending"
        ).select_related("campaign", "invited_by", "invited_user")

    def list(self, request):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="accept")
    def accept(self, request, pk=None):
        try:
            invitation = CampaignInvitation.objects.get(
                id=pk, invited_user=request.user, status="pending"
            )
        except CampaignInvitation.DoesNotExist:
            return Response(
                {"error": "Invitation not found."}, status=status.HTTP_404_NOT_FOUND
            )

        invitation.status = "accepted"
        invitation.save(update_fields=["status"])
        invitation.campaign.players.add(request.user)
        return Response({"status": "Invitation accepted."})

    @action(detail=True, methods=["post"], url_path="decline")
    def decline(self, request, pk=None):
        try:
            invitation = CampaignInvitation.objects.get(
                id=pk, invited_user=request.user, status="pending"
            )
        except CampaignInvitation.DoesNotExist:
            return Response(
                {"error": "Invitation not found."}, status=status.HTTP_404_NOT_FOUND
            )

        invitation.status = "declined"
        invitation.save(update_fields=["status"])
        return Response({"status": "Invitation declined."})
