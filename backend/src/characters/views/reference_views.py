from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets, permissions
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


MANUAL_TOGGLE_TRIGGERS = {"BELIEFS", "STRUGGLE", "STANDOUT"}
MANUAL_TOGGLE_DESCRIPTION_PREFIX = "Manual session XP toggle"


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


class ExperienceTrackerViewSet(viewsets.ReadOnlyModelViewSet):
    """Desperate-roll and other tracked XP gains; read-only. Filter by ?character= (owner or GM)."""
    permission_classes = [IsAuthenticated]
    queryset = ExperienceTracker.objects.all()
    serializer_class = ExperienceTrackerSerializer

    def get_queryset(self):
        # #region agent log
        import json
        import time as _dbg_time_ref

        def _dbg_experience_tracker_log():
            try:
                from django.db import connection
                from django.db.migrations.recorder import MigrationRecorder

                mig_0065 = MigrationRecorder.Migration.objects.filter(
                    app="characters",
                    name="0065_session_ripple_breathing_free_push",
                ).exists()
                col_present = None
                if connection.vendor == "sqlite":
                    with connection.cursor() as cur:
                        cur.execute("PRAGMA table_info(characters_session)")
                        names = {row[1] for row in cur.fetchall()}
                    col_present = (
                        "ripple_breathing_free_push_claimed_by_character" in names
                    )
                db_name = connection.settings_dict.get("NAME")
                payload = {
                    "sessionId": "068d9a",
                    "runId": "pre-fix",
                    "hypothesisId": "H1",
                    "location": "reference_views.ExperienceTrackerViewSet.get_queryset",
                    "message": "migrate 0065 vs sqlite column characters_session",
                    "data": {
                        "mig_0065_applied": mig_0065,
                        "ripple_col_in_db": col_present,
                        "db_vendor": connection.vendor,
                        "db_name_repr": repr(db_name),
                    },
                    "timestamp": int(_dbg_time_ref.time() * 1000),
                }
                path = "$HOME/git/jojo-ttrpg-platform/.cursor/debug-068d9a.log"
                with open(path, "a", encoding="utf-8") as df:
                    df.write(json.dumps(payload) + "\n")
            except Exception as ex:
                try:
                    with open(
                        "$HOME/git/jojo-ttrpg-platform/.cursor/debug-068d9a.log",
                        "a",
                        encoding="utf-8",
                    ) as df:
                        df.write(
                            json.dumps(
                                {
                                    "sessionId": "068d9a",
                                    "runId": "pre-fix",
                                    "hypothesisId": "H1",
                                    "location": "reference_views.ExperienceTrackerViewSet.get_queryset",
                                    "message": "debug log exception",
                                    "data": {"error": repr(ex)},
                                    "timestamp": int(_dbg_time_ref.time() * 1000),
                                }
                            )
                            + "\n"
                        )
                except Exception:
                    pass

        _dbg_experience_tracker_log()
        # #endregion
        qs = ExperienceTracker.objects.all().select_related('character', 'session', 'character__campaign')
        user = self.request.user
        if user.is_staff:
            return qs
        char_id = self.request.query_params.get('character')
        if char_id:
            char = Character.objects.filter(pk=char_id).select_related('campaign').first()
            if char and (char.user_id == user.id or (char.campaign_id and char.campaign.gm_id == user.id)):
                return qs.filter(character_id=char_id)
            return ExperienceTracker.objects.none()
        return qs.filter(character__user=user)

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
                Character.objects.select_related("campaign")
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
        """Award +1 XP for an end-of-session trigger (BELIEFS/STRUGGLE/STANDOUT).

        Respects the SRD 2-cap per session per trigger and writes to the
        character's playbook XP clock; idempotent at the cap (returns the
        current totals without creating a new entry).
        """
        character, session, trigger = self._resolve_toggle_context(request)
        with transaction.atomic():
            granted = grant_encoded_trigger_xp(
                character,
                session,
                trigger=trigger,
                clock_key="playbook",
                clock_max=10,
                want=1,
                description=f"{MANUAL_TOGGLE_DESCRIPTION_PREFIX}: {trigger}",
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
        the entry's ``xp_gained`` on the playbook clock (clamped to 0).
        No-op if no entry exists for this trigger in the active session.
        """
        character, session, trigger = self._resolve_toggle_context(request)
        with transaction.atomic():
            base = ExperienceTracker.objects.select_for_update().filter(
                character=character, session=session, trigger=trigger,
            )
            entry = (
                base.filter(
                    description__startswith=MANUAL_TOGGLE_DESCRIPTION_PREFIX,
                )
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
            entry.delete()
            if amount > 0:
                clocks = dict(character.xp_clocks or {})
                cur = int(clocks.get("playbook", 0) or 0)
                clocks["playbook"] = max(0, cur - amount)
                character.xp_clocks = clocks
                character.save(update_fields=["xp_clocks"])
        return Response(
            {
                "character": character.id,
                "session": session.id,
                "trigger": trigger,
                "revoked": amount,
            },
            status=status.HTTP_200_OK,
        )
