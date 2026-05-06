from django.db.models import Q
from rest_framework import viewsets, permissions
from rest_framework.permissions import IsAuthenticated

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
                can_view = can_view or camp.players.filter(pk=user.id).exists()
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