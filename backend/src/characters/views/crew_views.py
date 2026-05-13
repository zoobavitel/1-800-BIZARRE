from django.db import models
from django.core.exceptions import PermissionDenied
from rest_framework import viewsets, status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser

from ..models import Character, Crew, ExperienceTracker
from ..serializers import CrewSerializer

# Crew members (non-GM) may PATCH these fields; GM/staff have full access.
_CREW_MEMBER_ALLOWED_PATCH_FIELDS = frozenset(
    {
        "name",
        "stash_slots",
        "description",
        "notes",
        "upgrade_progress",
        "xp",
        "xp_track_size",
        "advancement_points",
        "level",
        "hold",
        "rep",
        "turf",
        "wanted_level",
        "coin",
        "stash",
        "image",
        "image_url",
        # Per-session crew XP trigger toggles; players write only the row for
        # the campaign's current active_session and must have an XP entry there.
        "session_xp_triggers",
        # Server-managed alongside session_xp_triggers merges (rep tally).
        "session_rep_contributions",
    }
)

# Trigger boolean keys that players may toggle in session_xp_triggers[sid].
# `credited` is set server-side by the settlement service and must NOT be
# changed via PATCH (we strip it before saving in the view).
_CREW_XP_TRIGGER_BOOL_KEYS = frozenset({"challenge", "reputation", "goals"})


class CrewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Crew.objects.all()
    serializer_class = CrewSerializer
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def get_queryset(self):
        # Filter crews based on user permissions
        user = self.request.user
        if user.is_staff:
            qs = Crew.objects.select_related("campaign").all()
        else:
            # Return crews from campaigns where user is GM or a member
            qs = (
                Crew.objects.select_related("campaign")
                .filter(
                    models.Q(campaign__gm=user)
                    | models.Q(campaign__characters__user=user)
                )
                .distinct()
            )

        campaign_id = self.request.query_params.get("campaign")
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        return qs

    @action(detail=True, methods=["post"], url_path="propose-name")
    def propose_name(self, request, pk=None):
        """Propose a new name for the crew (consensus flow)."""
        crew = self.get_object()
        proposed_name = (
            request.data.get("new_name") or request.data.get("name") or ""
        ).strip()

        if not proposed_name:
            return Response(
                {"error": "Crew name is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        if not self._is_crew_member(request.user, crew):
            return Response(
                {"error": "You are not a member of this crew."},
                status=status.HTTP_403_FORBIDDEN,
            )

        crew.proposed_name = proposed_name
        crew.proposed_by = request.user
        crew.approved_by.clear()
        crew.approved_by.add(request.user)
        crew.save()

        return Response(
            {
                "message": f'Proposed new name "{proposed_name}". Waiting for other members to approve.',
                "proposed_name": proposed_name,
                "proposed_by": request.user.username,
                "approved_by": [u.username for u in crew.approved_by.all()],
            }
        )

    @action(detail=True, methods=["post"], url_path="approve-name")
    def approve_name(self, request, pk=None):
        """Crew members approve a proposed name; when all members have approved, rename."""
        crew = self.get_object()
        user = request.user

        if not crew.proposed_name:
            return Response(
                {"error": "No name proposal is active."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not self._is_crew_member(user, crew):
            return Response(
                {"error": "You are not a member of this crew."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if user not in crew.approved_by.all():
            crew.approved_by.add(user)
            crew.save()

        all_member_users = set(
            crew.members.filter(user__isnull=False).values_list("user", flat=True)
        )
        approved_user_ids = set(crew.approved_by.values_list("id", flat=True))

        if all_member_users.issubset(approved_user_ids):
            crew.name = crew.proposed_name
            crew.proposed_name = None
            crew.proposed_by = None
            crew.approved_by.clear()
            crew.save()
            return Response(
                {
                    "message": f'Crew name changed to "{crew.name}" by consensus.',
                    "new_crew_name": crew.name,
                }
            )

        remaining = len(all_member_users) - len(approved_user_ids)
        return Response(
            {
                "message": f"You approved the name. Waiting for {remaining} more approvals.",
                "proposed_name": crew.proposed_name,
                "proposed_by": crew.proposed_by.username if crew.proposed_by else None,
                "approved_by": [u.username for u in crew.approved_by.all()],
            }
        )

    def perform_create(self, serializer):
        """Restrict crew creation to GMs/staff or players already in the campaign.

        The personal-crew-name auto-attach path in CharacterSerializer creates
        crews server-side. This guard ensures direct POSTs to `/api/crews/`
        from the UI still require the caller to belong to the target campaign
        (matches the "any player or GM in the campaign" intent for crew
        ownership without letting outsiders seed crews into other campaigns).
        """
        user = self.request.user
        campaign = serializer.validated_data.get("campaign")
        if campaign is None:
            raise DRFValidationError({"campaign": "Crew must be tied to a campaign."})
        if user.is_staff or campaign.gm_id == user.id:
            serializer.save()
            return
        is_campaign_player = (
            campaign.players.filter(id=user.id).exists()
            or Character.objects.filter(campaign=campaign, user=user).exists()
        )
        if not is_campaign_player:
            raise PermissionDenied(
                "Only the GM or a player in this campaign can create its crew."
            )
        serializer.save()

    def perform_update(self, serializer):
        crew = self.get_object()
        user = self.request.user
        is_gm_or_staff = crew.campaign.gm_id == user.id or user.is_staff
        if "session_xp_triggers" in serializer.validated_data:
            self._authorize_session_xp_triggers_patch(
                user, crew, serializer.validated_data, is_gm_or_staff
            )
        if is_gm_or_staff:
            serializer.save()
            crew.refresh_from_db()
            if "name" in serializer.validated_data:
                crew.proposed_name = None
                crew.proposed_by = None
                crew.save(update_fields=["proposed_name", "proposed_by"])
                crew.approved_by.clear()
            return
        # Crew members can update shared crew sheet fields (name, stash grid, resources, etc.)
        if self._is_crew_member(user, crew):
            validated = serializer.validated_data
            if set(validated.keys()) <= _CREW_MEMBER_ALLOWED_PATCH_FIELDS:
                serializer.save()
                crew.refresh_from_db()
                if "name" in validated:
                    crew.proposed_name = None
                    crew.proposed_by = None
                    crew.save(update_fields=["proposed_name", "proposed_by"])
                    crew.approved_by.clear()
                return
        raise PermissionDenied("Only the GM or crew members can update this crew")

    def _authorize_session_xp_triggers_patch(
        self, user, crew, validated_data, is_gm_or_staff
    ):
        """Merge + gate writes to `Crew.session_xp_triggers`.

        Rules:
          * Players may only toggle triggers for the campaign's current
            `active_session` and only after **some** PC in this crew has earned
            at least one XP entry in that session (`xp_gained > 0`).
            This implements "Toggle only if a crew member triggered XP this
            session" — see `Crew.session_xp_triggers` doc.
          * Players may never set the `credited` flag (that is owned by
            `services.crew_xp_triggers.credit_crew_xp_triggers_for_session`).
            We strip it from incoming rows here.
          * GM/staff can edit any session row (used for manual fixes); we
            still strip stale rows to keep the JSON small but accept whatever
            booleans the GM sends.
          * Other session rows in the PATCH body are dropped unless they
            already exist on the crew with the same shape (read-modify-write
            preservation). This avoids letting a stale client overwrite older
            credited rows.
        """
        incoming = validated_data.get("session_xp_triggers") or {}
        if not isinstance(incoming, dict):
            raise DRFValidationError(
                {"session_xp_triggers": "Expected an object keyed by session id."}
            )
        active_session_id = getattr(crew.campaign, "active_session_id", None)
        existing = dict(crew.session_xp_triggers or {})
        merged: dict[str, dict] = {
            sid: dict(row) for sid, row in existing.items() if isinstance(row, dict)
        }
        rep_data = dict(crew.session_rep_contributions or {})
        actor_cid = Character.objects.filter(user=user, crew_id=crew.id).values_list(
            "id", flat=True
        ).first()
        for sid_raw, row in incoming.items():
            sid = str(sid_raw)
            if not isinstance(row, dict):
                continue
            sanitized = {
                k: bool(row[k])
                for k in _CREW_XP_TRIGGER_BOOL_KEYS
                if k in row
            }
            if not sanitized:
                # Empty row: leave existing untouched (no implicit deletes).
                continue
            before_row = dict(merged.get(sid, {}) or {})
            if is_gm_or_staff:
                merged[sid] = {**before_row, **sanitized}
            else:
                # Player path: only the current active session, and only if a
                # crew PC has earned XP this session.
                if active_session_id is None:
                    raise DRFValidationError(
                        {
                            "session_xp_triggers": (
                                "No active session on this campaign; only the GM can "
                                "edit crew XP triggers outside a live session."
                            )
                        }
                    )
                if sid != str(active_session_id):
                    raise DRFValidationError(
                        {
                            "session_xp_triggers": (
                                "Players may only toggle the crew XP row for the "
                                "current active session."
                            )
                        }
                    )
                earned = ExperienceTracker.objects.filter(
                    character__crew_id=crew.id,
                    session_id=active_session_id,
                    xp_gained__gt=0,
                ).exists()
                if not earned:
                    raise DRFValidationError(
                        {
                            "session_xp_triggers": (
                                "Crew XP triggers unlock once any crew member has "
                                "earned XP in this session."
                            )
                        }
                    )
                prev = dict(merged.get(sid, {}) or {})
                # Toggling clears `credited` — the settlement service re-credits
                # when the session is finalized.
                prev.pop("credited", None)
                merged[sid] = {**prev, **sanitized}
            old_rep = bool(before_row.get("reputation"))
            new_rep = bool((merged.get(sid) or {}).get("reputation"))
            if actor_cid and old_rep != new_rep:
                sid_rep = dict(rep_data.get(sid, {}) or {})
                k = str(actor_cid)
                cur = int(sid_rep.get(k, 0) or 0)
                if not old_rep and new_rep:
                    sid_rep[k] = cur + 1
                elif old_rep and not new_rep:
                    sid_rep[k] = max(0, cur - 1)
                rep_data[sid] = sid_rep
        validated_data["session_xp_triggers"] = merged
        validated_data["session_rep_contributions"] = CrewSerializer(
            context=self.get_serializer_context()
        ).validate_session_rep_contributions(rep_data)

    def _is_crew_member(self, user, crew):
        """Check if a user has a character in this crew."""
        return crew.members.filter(user=user).exists()
