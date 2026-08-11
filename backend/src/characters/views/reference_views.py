from django.db import transaction
from django.db.models import Q
from rest_framework import mixins, status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import (
    Heritage, Vice, Ability, Stand, StandAbility, HamonAbility, SpinAbility,
    Trauma, CharacterHistory, CrewHistory, Character, ExperienceTracker, Campaign,
    Crew,
)
from ..serializers import (
    HeritageSerializer, ViceSerializer, AbilitySerializer, StandSerializer,
    StandAbilitySerializer, HamonAbilitySerializer, SpinAbilitySerializer,
    TraumaSerializer, CharacterHistorySerializer, CrewHistorySerializer,
    ExperienceTrackerSerializer,
)
from ..services.session_xp_settlement import grant_encoded_trigger_xp
from ..services.playbook_xp_archetype import resolve_playbook_xp_archetype_labels

MANUAL_TOGGLE_TRIGGERS = {"BELIEFS", "STRUGGLE", "PLAYBOOK_SPECIFIC"}
# Trigger toggles are SRD end-of-session trigger records confirmed by a human
# (player or GM) rather than auto-detected from a roll. They are not the same
# thing as the free-form "MANUAL" track-grant rows from the character sheet's
# "Add XP" flow — `trigger` differs (BELIEFS/STRUGGLE/PLAYBOOK_SPECIFIC vs MANUAL) and
# the audit / scorecard accounting treats them in separate columns.
SESSION_TRIGGER_DESCRIPTION_PREFIX = "Session XP trigger"
# Legacy prefix kept so `manual_revoke` can still find rows written before
# the rename data migration applied. New rows are written with the new prefix.
LEGACY_MANUAL_TOGGLE_DESCRIPTION_PREFIX = "Manual session XP toggle"

class HeritageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Heritage.objects.all()
    serializer_class = HeritageSerializer

class ViceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Vice.objects.all()
    serializer_class = ViceSerializer

class AbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Ability.objects.all()
    serializer_class = AbilitySerializer

class StandViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Stand.objects.all()
    serializer_class = StandSerializer

class StandAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = StandAbility.objects.all()
    serializer_class = StandAbilitySerializer

class HamonAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = HamonAbility.objects.all()
    serializer_class = HamonAbilitySerializer

class SpinAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = SpinAbility.objects.all()
    serializer_class = SpinAbilitySerializer

class TraumaViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only endpoint for trauma conditions."""
    permission_classes = [IsAuthenticated]
    queryset = Trauma.objects.all()
    serializer_class = TraumaSerializer

class CharacterHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CharacterHistorySerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def get_queryset(self):
        user = self.request.user
        campaign_id = self.request.query_params.get("campaign")
        character_id = self.request.query_params.get("character")
        qs = CharacterHistory.objects.all().select_related(
            "character", "character__campaign", "editor"
        )

        if user.is_staff:
            base = qs
            if character_id:
                try:
                    base = base.filter(character_id=int(character_id))
                except (TypeError, ValueError):
                    return CharacterHistory.objects.none()
            elif campaign_id:
                try:
                    base = base.filter(character__campaign_id=int(campaign_id))
                except (TypeError, ValueError):
                    return CharacterHistory.objects.none()
            return base.order_by("-timestamp")

        if character_id:
            try:
                ch_pk = int(character_id)
            except (TypeError, ValueError):
                return CharacterHistory.objects.none()
            char = Character.objects.filter(pk=ch_pk).select_related("campaign").first()
            if not char:
                return CharacterHistory.objects.none()
            can_view = char.user_id == user.id
            if char.campaign_id:
                camp = char.campaign
                can_view = can_view or camp.gm_id == user.id
            if not can_view:
                return CharacterHistory.objects.none()
            if campaign_id:
                try:
                    cap = int(campaign_id)
                except (TypeError, ValueError):
                    return CharacterHistory.objects.none()
                if char.campaign_id != cap:
                    return CharacterHistory.objects.none()
            return qs.filter(character_id=ch_pk).order_by("-timestamp")

        if campaign_id:
            try:
                cid = int(campaign_id)
            except (TypeError, ValueError):
                return CharacterHistory.objects.none()
            campaign = Campaign.objects.filter(pk=cid).first()
            if not campaign or campaign.gm_id != user.id:
                return CharacterHistory.objects.none()
            return qs.filter(character__campaign_id=cid).order_by("-timestamp")

        return (
            qs.filter(
                Q(character__user=user)
                | Q(character__campaign__gm=user)
                | Q(character__campaign__players=user)
            )
            .distinct()
            .order_by("-timestamp")
        )

    @action(detail=True, methods=["post"], url_path="undo")
    def undo_entry(self, request, pk=None):
        entry = self.get_object()
        from ..services.character_history_undo import (
            CharacterHistoryUndoError,
            undo_character_history_entry,
        )
        from ..views.character_views import _character_response

        try:
            undo_character_history_entry(entry, user=request.user)
        except CharacterHistoryUndoError as exc:
            return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        character = Character.objects.get(pk=entry.character_id)
        return Response(
            {
                "success": True,
                "history_id": entry.id,
                "character": _character_response(character),
            }
        )

class CrewHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Audit of crew sheet scalar changes; filter with ?crew=<id>."""

    permission_classes = [IsAuthenticated]
    serializer_class = CrewHistorySerializer

    def get_queryset(self):
        user = self.request.user
        qs = CrewHistory.objects.all().select_related(
            "crew", "crew__campaign", "editor"
        )
        if user.is_staff:
            base = qs
        else:
            member_crew_ids = Crew.objects.filter(
                members__user=user
            ).values_list("id", flat=True)
            gm_crew_ids = Crew.objects.filter(campaign__gm=user).values_list(
                "id", flat=True
            )
            allowed = set(member_crew_ids) | set(gm_crew_ids)
            if not allowed:
                return CrewHistory.objects.none()
            base = qs.filter(crew_id__in=allowed)
        crew_id = self.request.query_params.get("crew")
        if crew_id:
            base = base.filter(crew_id=crew_id)
        return base.order_by("-timestamp")

class ExperienceTrackerViewSet(
    mixins.DestroyModelMixin,
    viewsets.ReadOnlyModelViewSet,
):
    """Desperate-roll and other tracked XP gains.

    List/retrieve are filterable by ``?character=`` (owner or GM); ``destroy``
    deletes a specific XP entry and rolls back the matching xp clock so that
    GMs and players can remove *any* XP record (manual, auto, mid-session or
    end-of-session settlement) during an active session.
    """
    permission_classes = [IsAuthenticated]
    queryset = ExperienceTracker.objects.all()
    serializer_class = ExperienceTrackerSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def get_queryset(self):
        qs = ExperienceTracker.objects.filter(
            revoked_at__isnull=True
        ).select_related('character', 'session', 'character__campaign')
        user = self.request.user
        if user.is_staff:
            return qs
        char_id = self.request.query_params.get('character')
        if char_id:
            char = Character.objects.filter(pk=char_id).select_related('campaign').first()
            if char and (char.user_id == user.id or (char.campaign_id and char.campaign.gm_id == user.id)):
                return qs.filter(character_id=char_id)
            return ExperienceTracker.objects.none()
        return qs.filter(
            Q(character__user=user) | Q(character__campaign__gm=user)
        ).distinct()

    def _resolve_toggle_context(self, request):
        """Validate character, trigger, and active session for award/revoke toggles."""
        character_id = request.data.get("character")
        trigger = request.data.get("trigger")
        if not character_id:
            raise ValidationError({"character": "Required."})
        if trigger not in MANUAL_TOGGLE_TRIGGERS:
            raise ValidationError(
                {"trigger": f"Must be one of {sorted(MANUAL_TOGGLE_TRIGGERS)}."}
            )
        try:
            character = (
                Character.objects.select_related("campaign", "stand")
                .prefetch_related(
                    "hamon_abilities__hamon_ability",
                    "spin_abilities__spin_ability",
                )
                .get(pk=character_id)
            )
        except Character.DoesNotExist:
            raise ValidationError({"character": "Character not found."})

        user = request.user
        campaign = character.campaign
        is_owner = character.user_id == user.id
        is_gm = bool(campaign) and campaign.gm_id == user.id
        if not (user.is_staff or is_owner or is_gm):
            raise PermissionDenied(
                "Only the character owner or campaign GM can toggle session XP."
            )

        active_session = getattr(campaign, "active_session", None) if campaign else None
        if active_session is None:
            raise ValidationError(
                {"session": "Campaign has no active session — XP toggles require one."}
            )
        return character, active_session, trigger

    @action(detail=False, methods=["post"], url_path="award")
    def manual_award(self, request):
        """Award +1 XP for an end-of-session trigger (BELIEFS/STRUGGLE/PLAYBOOK_SPECIFIC).

        Respects the SRD 2-cap per session per trigger and banks XP to the
        character's free pool (``unallocated_xp``); idempotent at the cap.
        Records the caller as ``awarded_by`` and tags ``award_source``.
        """
        character, session, trigger = self._resolve_toggle_context(request)
        user = request.user
        is_owner = character.user_id == user.id
        is_gm = bool(
            character.campaign_id
            and character.campaign.gm_id == user.id
        )
        source = "GM" if (is_gm and not is_owner) else "PLAYER"
        desc = f"{SESSION_TRIGGER_DESCRIPTION_PREFIX}: {trigger}"
        if trigger == "PLAYBOOK_SPECIFIC":
            labels = resolve_playbook_xp_archetype_labels(character)
            if labels:
                desc = f"{desc} ({labels})"
        with transaction.atomic():
            granted = grant_encoded_trigger_xp(
                character,
                session,
                trigger=trigger,
                clock_key="pool",
                clock_max=0,
                want=1,
                description=desc,
                awarded_by=user,
                award_source=source,
            )
        return Response(
            {
                "character": character.id,
                "session": session.id,
                "trigger": trigger,
                "granted": granted,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="revoke")
    def manual_revoke(self, request):
        """Revoke the most recent session XP entry for this trigger.

        Prefers manual-toggle rows so players can undo accidental toggles
        first; falls back to the most recent auto-grant (e.g. heritage,
        vice overindulgence, trauma) for the same trigger so that GMs and
        players can also delete those records from the scorecard. Rolls back
        ``xp_gained`` on the entry's stored ``clock_key`` (``pool`` → free
        pool; otherwise a track; legacy empty defaults to pool).
        No-op if no entry exists for this trigger in the active session.
        """
        character, session, trigger = self._resolve_toggle_context(request)
        with transaction.atomic():
            base = ExperienceTracker.objects.select_for_update().filter(
                character=character, session=session, trigger=trigger,
            )
            toggle_q = Q(
                description__startswith=SESSION_TRIGGER_DESCRIPTION_PREFIX,
            ) | Q(
                description__startswith=LEGACY_MANUAL_TOGGLE_DESCRIPTION_PREFIX,
            )
            entry = (
                base.filter(toggle_q)
                .order_by("-session_date", "-id")
                .first()
            ) or base.order_by("-session_date", "-id").first()
            if entry is None:
                return Response(
                    {
                        "character": character.id,
                        "session": session.id,
                        "trigger": trigger,
                        "revoked": 0,
                    },
                    status=status.HTTP_200_OK,
                )
            amount = int(entry.xp_gained or 0)
            clock_key = (entry.clock_key or "").strip() or "pool"
            entry.delete()
            if amount > 0:
                _rollback_xp_destination(character, clock_key, amount)
        return Response(
            {
                "character": character.id,
                "session": session.id,
                "trigger": trigger,
                "revoked": amount,
            },
            status=status.HTTP_200_OK,
        )

    def destroy(self, request, *args, **kwargs):
        """Delete an XP entry and roll back its destination (track or free pool).

        Allowed for the character owner or the campaign GM. Players cannot
        delete GM or automatic session XP from the character sheet — use the
        campaign scorecard instead.
        """
        from ..services.character_history_undo import experience_tracker_undoable_from_sheet

        entry = self.get_object()
        character = entry.character
        user = request.user
        is_owner = character.user_id == user.id
        is_gm = bool(
            character.campaign_id
            and character.campaign.gm_id == user.id
        )
        if not (user.is_staff or is_owner or is_gm):
            raise PermissionDenied(
                "Only the character owner or campaign GM can delete XP entries."
            )
        allowed, reason = experience_tracker_undoable_from_sheet(entry, user)
        if not allowed:
            return Response({"error": reason}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            locked_entry = ExperienceTracker.objects.select_for_update().get(
                pk=entry.pk
            )
            locked_char = Character.objects.select_for_update().get(
                pk=character.pk
            )
            amount = int(locked_entry.xp_gained or 0)
            clock_key = (locked_entry.clock_key or "").strip()
            desc = locked_entry.description or ""
            locked_entry.delete()
            if amount > 0:
                if clock_key:
                    _rollback_xp_destination(locked_char, clock_key, amount)
                elif "Session end (pool)" in desc:
                    _rollback_xp_destination(locked_char, "pool", amount)
        return Response(status=status.HTTP_204_NO_CONTENT)

def _rollback_xp_destination(character, clock_key: str, amount: int) -> None:
    """Decrement free pool or ``xp_clocks[clock_key]`` by ``amount`` (clamped)."""
    key = (clock_key or "").strip()
    if not key or key == "pool":
        cur = int(getattr(character, "unallocated_xp", 0) or 0)
        character.unallocated_xp = max(0, cur - int(amount))
        character.save(update_fields=["unallocated_xp"])
        return
    clocks = dict(character.xp_clocks or {})
    cur = int(clocks.get(key, 0) or 0)
    clocks[key] = max(0, cur - int(amount))
    character.xp_clocks = clocks
    character.save(update_fields=["xp_clocks"])

def _rollback_clock(character, clock_key: str, amount: int) -> None:
    """Deprecated alias — prefer ``_rollback_xp_destination``."""
    _rollback_xp_destination(character, clock_key, amount)
