from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from django.http import HttpResponse

from ..models import NPC
from ..parsers import MultipartJsonParser
from ..serializers import NPCSerializer

# Effect level to clock ticks (SRD: Limited=1, Standard=2, top tier=3; aligns with Roll effect "extreme")
EFFECT_TO_TICKS = {'limited': 1, 'standard': 2, 'great': 3, 'greater': 3, 'extreme': 3}


class NPCViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = NPC.objects.all()
    serializer_class = NPCSerializer
    parser_classes = (JSONParser, MultipartJsonParser, FormParser)

    def dispatch(self, request, *args, **kwargs):
        response = super().dispatch(request, *args, **kwargs)
        # #region agent log
        if request.method in ("PUT", "PATCH", "POST"):
            try:
                import json as _json, time as _time
                with open(
                    "$HOME/git/jojo-ttrpg-platform/.cursor/debug-80d307.log",
                    "a",
                    encoding="utf-8",
                ) as df:
                    df.write(
                        _json.dumps(
                            {
                                "sessionId": "80d307",
                                "runId": "pre-fix",
                                "hypothesisId": "A",
                                "location": "npc_views.py:dispatch",
                                "message": "NPCViewSet.dispatch done",
                                "data": {
                                    "method": request.method,
                                    "path": getattr(request, "path", None),
                                    "pk": kwargs.get("pk"),
                                    "status": getattr(response, "status_code", None),
                                    "auth": bool(
                                        getattr(request.user, "is_authenticated", False)
                                    ),
                                    "username": getattr(request.user, "username", None),
                                },
                                "timestamp": int(_time.time() * 1000),
                            }
                        )
                        + "\n"
                    )
            except Exception:
                pass
        # #endregion
        return response

    def get_queryset(self):
        user = self.request.user
        mine = self.request.query_params.get('mine', '').lower() in ('1', 'true')

        if mine:
            qs = NPC.objects.filter(creator=user)
        elif user.is_staff:
            qs = NPC.objects.all()
        else:
            qs = NPC.objects.filter(Q(creator=user) | Q(campaign__gm=user)).distinct()

        campaign_id = self.request.query_params.get('campaign')
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        return qs

    def _user_can_edit_npc_clocks(self, request, npc):
        """Only GM (campaign GM or NPC creator) can tick NPC clocks. Players cannot deal harm to NPCs."""
        user = request.user
        if user.is_staff:
            return True
        if npc.creator_id and npc.creator_id == user.id:
            return True
        if npc.campaign_id and getattr(npc.campaign, 'gm_id', None) == user.id:
            return True
        return False

    @action(detail=True, methods=['post'], url_path='apply-effect')
    def apply_effect(self, request, pk=None):
        """
        GM-only: Apply the effect of a roll to an NPC's vulnerability clock.
        Effect → ticks: limited=1, standard=2, great/greater/extreme=3.
        """
        npc = self.get_object()
        if not self._user_can_edit_npc_clocks(request, npc):
            return Response(
                {'error': 'Only the GM (or NPC creator) can apply effect to NPC clocks. Players cannot deal harm to NPCs.'},
                status=status.HTTP_403_FORBIDDEN
            )
        effect = (request.data.get('effect') or '').strip().lower()
        clock_type = (request.data.get('clock_type') or 'vulnerability').strip().lower()
        if effect not in EFFECT_TO_TICKS:
            return Response(
                {'error': f'effect must be one of: {", ".join(EFFECT_TO_TICKS)}', 'effect': effect},
                status=status.HTTP_400_BAD_REQUEST
            )
        if clock_type != 'vulnerability':
            return Response(
                {'error': 'clock_type must be "vulnerability"', 'clock_type': clock_type},
                status=status.HTTP_400_BAD_REQUEST
            )
        ticks = EFFECT_TO_TICKS[effect]
        max_segments = npc.vulnerability_clock_max
        current = npc.vulnerability_clock_current
        new_value = min(current + ticks, max_segments)
        npc.vulnerability_clock_current = new_value
        npc.save(update_fields=['vulnerability_clock_current'])
        return Response({
            'clock_type': 'vulnerability',
            'effect': effect,
            'ticks_applied': ticks,
            'previous': current,
            'current': new_value,
            'max': max_segments,
            'defeated': new_value >= max_segments and max_segments > 0,
        })

    def update(self, request, *args, **kwargs):
        # #region agent log
        try:
            import json as _json, time as _time
            abilities = request.data.get("abilities") if hasattr(request, "data") else None
            descs = []
            if isinstance(abilities, list):
                for a in abilities:
                    if isinstance(a, dict):
                        descs.append(str(a.get("description") or ""))
            joined = "\n".join(descs)
            payload = {
                "sessionId": "80d307",
                "runId": "pre-fix",
                "hypothesisId": "F",
                "location": "npc_views.py:update",
                "message": "NPCViewSet.update entry",
                "data": {
                    "pk": kwargs.get("pk"),
                    "auth": bool(getattr(request.user, "is_authenticated", False)),
                    "username": getattr(request.user, "username", None),
                    "content_type": request.content_type,
                    "ability_count": len(abilities) if isinstance(abilities, list) else None,
                    "desc_lens": [len(d) for d in descs],
                    "has_curly": any(ord(c) in (0x201C, 0x201D) for c in joined),
                    "preview": joined[:80],
                },
                "timestamp": int(_time.time() * 1000),
            }
            with open(
                "$HOME/git/jojo-ttrpg-platform/.cursor/debug-80d307.log",
                "a",
                encoding="utf-8",
            ) as df:
                df.write(_json.dumps(payload) + "\n")
        except Exception:
            pass
        # #endregion
        try:
            response = super().update(request, *args, **kwargs)
            # #region agent log
            try:
                import json as _json, time as _time
                with open(
                    "$HOME/git/jojo-ttrpg-platform/.cursor/debug-80d307.log",
                    "a",
                    encoding="utf-8",
                ) as df:
                    df.write(
                        _json.dumps(
                            {
                                "sessionId": "80d307",
                                "runId": "pre-fix",
                                "hypothesisId": "F",
                                "location": "npc_views.py:update:ok",
                                "message": "NPCViewSet.update ok",
                                "data": {
                                    "pk": kwargs.get("pk"),
                                    "status": getattr(response, "status_code", None),
                                },
                                "timestamp": int(_time.time() * 1000),
                            }
                        )
                        + "\n"
                    )
            except Exception:
                pass
            # #endregion
            return response
        except Exception as exc:
            # #region agent log
            try:
                import json as _json, time as _time
                with open(
                    "$HOME/git/jojo-ttrpg-platform/.cursor/debug-80d307.log",
                    "a",
                    encoding="utf-8",
                ) as df:
                    df.write(
                        _json.dumps(
                            {
                                "sessionId": "80d307",
                                "runId": "pre-fix",
                                "hypothesisId": "F",
                                "location": "npc_views.py:update:exc",
                                "message": "NPCViewSet.update exception",
                                "data": {
                                    "pk": kwargs.get("pk"),
                                    "exc_type": type(exc).__name__,
                                    "exc": str(exc)[:300],
                                },
                                "timestamp": int(_time.time() * 1000),
                            }
                        )
                        + "\n"
                    )
            except Exception:
                pass
            # #endregion
            raise

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        """Download a fillable PDF snapshot of this NPC sheet."""
        try:
            from ..services.sheet_export import export_npc_pdf
        except ImportError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        npc = self.get_object()
        try:
            pdf_bytes, filename = export_npc_pdf(npc)
        except ImportError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response