import logging
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.db.models import Q
from rest_framework import viewsets, status, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, FormParser
from django.db import transaction
from django.core.exceptions import PermissionDenied
import json

import random
from ..models import (
    AssistHelpPending,
    Campaign,
    Character,
    CharacterHamonAbility,
    CharacterXPAllocation,
    ExperienceTracker,
    GroupAction,
    NPC,
    Session,
    Roll,
    RollHistory,
)
from ..parsers import MultipartJsonParser
from ..roll_helpers import (
    STAND_POOL_STAT_KEYS,
    action_rating_from_action_dots,
    award_desperate_action_xp,
    award_heritage_expression_xp,
    bump_effect,
    heritage_bonus_labels,
    max_stress_slots_for_character,
    normalized_trauma_pks,
    normalize_effect,
    normalize_position,
    outcome_from_action_roll,
    recovery_healing_clock_segments,
    stand_action_rating_from_character,
    tier_die_from_action_pool,
    award_struggle_for_new_traumas,
)
from ..serializers import CharacterSerializer, CharacterXPAllocationSerializer
from ..history_context import bind_character_history_editor, reset_character_history_editor
from ..services.xp_allocation import (
    XPAllocationError,
    apply_level_up,
    apply_minor_advance,
    list_allocations,
    redo_allocation,
    undo_allocation,
)
from ..services.character_history_undo import (
    CharacterHistoryUndoError,
    gm_redo_status,
    gm_undo_status,
    redo_latest_gm_change,
    undo_latest_gm_change,
)


def _character_queryset_for_user(user):
    """Own PCs plus campaign-visible PCs for this user (staff sees all)."""
    if user.is_staff:
        return Character.objects.all()
    return Character.objects.filter(
        Q(user=user) | Q(campaign__gm=user) | Q(campaign__players=user)
    ).distinct()


# Backward-compatible name for code that imported the old detail-only helper.
_character_queryset_detail = _character_queryset_for_user


def _max_stress_for_character(character):
    """Stress capacity from durability grade (SRD baseline: 9, modified by DUR)."""
    grade = None
    stand = getattr(character, "stand", None)
    if stand is not None:
        grade = getattr(stand, "durability", None)
    if not grade:
        coin_stats = getattr(character, "coin_stats", None) or {}
        if isinstance(coin_stats, dict):
            grade = coin_stats.get("durability") or coin_stats.get("DURABILITY")
    return {"S": 13, "A": 12, "B": 11, "C": 10, "D": 9, "F": 8}.get(grade, 9)


def _user_may_edit_character(user, character):
    if user.is_staff:
        return True
    if character.user_id == user.id:
        return True
    if character.campaign_id and character.campaign.gm_id == user.id:
        return True
    return False


def _allocation_list_response(character):
    qs = list_allocations(character, include_undone=True)
    latest = list_allocations(character).first()
    latest_undone = (
        CharacterXPAllocation.objects.filter(
            character=character, undone_at__isnull=False
        )
        .order_by("-undone_at", "-id")
        .first()
    )
    serializer = CharacterXPAllocationSerializer(
        qs,
        many=True,
        context={
            "latest_undoable_allocation_id": latest.id if latest else None,
            "latest_redoable_allocation_id": (
                latest_undone.id if latest_undone else None
            ),
        },
    )
    return serializer.data


def _character_response(character):
    return CharacterSerializer(character).data


class CharacterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CharacterSerializer
    queryset = Character.objects.all()
    parser_classes = (JSONParser, MultipartJsonParser, FormParser)

    def get_queryset(self):
        user = self.request.user
        if self.request.query_params.get("mine") == "true":
            return Character.objects.filter(user=user)
        return _character_queryset_for_user(user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger = logging.getLogger(__name__)
            logger.warning("Character create validation failed: %s", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    def perform_create(self, serializer):
        user = self.request.user
        token = bind_character_history_editor(user)
        try:
            serializer.save(user=user)
        finally:
            reset_character_history_editor(token)

    def perform_update(self, serializer):
        instance = serializer.instance
        user = self.request.user
        is_owner = instance.user_id == user.id
        is_gm = instance.campaign_id and instance.campaign.gm_id == user.id
        if not (user.is_staff or is_owner or is_gm):
            raise PermissionDenied(
                "You may only edit your own characters unless you are the campaign GM."
            )

        # The CharacterSerializer marks `user` as read_only=True, so it will
        # never be present in validated_data and ownership cannot change through
        # the normal serializer path. This remains a defensive belt-and-
        # suspenders guard: if a future refactor accidentally makes the field
        # writable, force the original owner during save so both the database
        # row and serializer.instance stay in sync for the response.
        original_user_id = serializer.instance.user_id
        token = bind_character_history_editor(user)
        try:
            prev_trauma_pks = normalized_trauma_pks(serializer.instance.trauma)
            with transaction.atomic():
                serializer.save(user_id=original_user_id)
                inst = serializer.instance
                gained = normalized_trauma_pks(inst.trauma) - prev_trauma_pks
                if gained:
                    campaign = getattr(inst, "campaign", None)
                    act = (
                        getattr(campaign, "active_session", None)
                        if campaign is not None
                        else None
                    )
                    if (
                        act is not None
                        and getattr(act, "campaign_id", None) == inst.campaign_id
                        and getattr(inst, "campaign_id", None)
                    ):
                        award_struggle_for_new_traumas(inst, act, gained)
        finally:
            reset_character_history_editor(token)

    def perform_destroy(self, instance):
        user = self.request.user
        is_owner = instance.user_id == user.id
        is_gm = instance.campaign_id and instance.campaign.gm_id == user.id
        if not (user.is_staff or is_owner or is_gm):
            raise PermissionDenied("You may only delete your own characters.")
        instance.delete()

    @action(
        detail=False,
        methods=["get"],
        url_path="creation-guide",
        permission_classes=[permissions.AllowAny],
    )
    def creation_guide(self, request):
        """Get character creation guide and available options."""
        guide = {
            "heritages": [
                {
                    "id": 1,
                    "name": "Stand User",
                    "description": "A person with a Stand ability",
                },
                {
                    "id": 2,
                    "name": "Hamon User",
                    "description": "A person who can use Hamon energy",
                },
                {
                    "id": 3,
                    "name": "Spin User",
                    "description": "A person who can use the Spin technique",
                },
            ],
            "vices": [
                {
                    "id": 1,
                    "name": "Faith",
                    "description": "Religious devotion and spiritual practices",
                },
                {
                    "id": 2,
                    "name": "Gambling",
                    "description": "Risk-taking and games of chance",
                },
                {
                    "id": 3,
                    "name": "Luxury",
                    "description": "Indulgence in fine things and comforts",
                },
                {
                    "id": 4,
                    "name": "Obligation",
                    "description": "Duty and responsibility to others",
                },
                {
                    "id": 5,
                    "name": "Pleasure",
                    "description": "Physical and emotional gratification",
                },
                {
                    "id": 6,
                    "name": "Stupor",
                    "description": "Escapism through substances or activities",
                },
                {
                    "id": 7,
                    "name": "Weird",
                    "description": "Unusual or bizarre interests and activities",
                },
            ],
            "abilities": [
                {
                    "id": 1,
                    "name": "Insight",
                    "description": "Perception and understanding",
                },
                {
                    "id": 2,
                    "name": "Prowess",
                    "description": "Physical ability and combat skill",
                },
                {
                    "id": 3,
                    "name": "Resolve",
                    "description": "Mental fortitude and willpower",
                },
                {"id": 4, "name": "Study", "description": "Knowledge and learning"},
                {
                    "id": 5,
                    "name": "Tinker",
                    "description": "Technical skill and craftsmanship",
                },
            ],
            "stand_coin_stats": [
                {
                    "name": "Power",
                    "description": "Physical strength and destructive capability",
                },
                {
                    "name": "Speed",
                    "description": "How fast the Stand moves or acts; affects starting position in most conflicts.",
                },
                {
                    "name": "Range",
                    "description": "Distance the Stand can operate from the user",
                },
                {
                    "name": "Durability",
                    "description": "Resistance to damage and ability to endure",
                },
                {"name": "Precision", "description": "Accuracy and fine control"},
                {
                    "name": "Development",
                    "description": "Growth potential and development capability",
                },
            ],
        }
        return Response(guide)

    @action(detail=True, methods=["patch"], url_path="update-field")
    def update_field(self, request, pk=None):
        """Update a specific field on a character."""
        character = self.get_object()
        is_owner = character.user_id == request.user.id
        is_gm = character.campaign_id and character.campaign.gm_id == request.user.id
        if not (request.user.is_staff or is_owner or is_gm):
            raise PermissionDenied(
                "You may only edit your own characters unless you are the campaign GM."
            )
        field_name = request.data.get("field")
        value = request.data.get("value")

        if not field_name:
            return Response(
                {"error": "Field name is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Check if field exists and is editable
        if not hasattr(character, field_name):
            return Response(
                {"error": f"Field {field_name} does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update the field
        setattr(character, field_name, value)
        character.save()

        return Response({"message": f"Field {field_name} updated successfully"})

    @action(detail=True, methods=["post"], url_path="roll-action")
    def roll_action(self, request, pk=None):
        """Roll dice for a character action. Supports position, effect, push (stress), and persists to Roll when session_id provided."""
        character = self.get_object()
        action_name = request.data.get("action")
        session_id = request.data.get("session_id")

        def _as_bool(v):
            if v is True:
                return True
            if v is False or v is None:
                return False
            if isinstance(v, str):
                return v.strip().lower() in ("1", "true", "yes", "on")
            return bool(v)

        push_effect = _as_bool(request.data.get("push_effect", False))
        push_dice = _as_bool(request.data.get("push_dice", False))
        devil_bargain_dice = _as_bool(request.data.get("devil_bargain_dice", False))
        devil_bargain_note = request.data.get("devil_bargain_note", "")
        devil_bargain_confirmed = bool(
            request.data.get("devil_bargain_confirmed", False)
        )
        stress_overflow_accepted = _as_bool(
            request.data.get("stress_overflow_accepted", False)
        )
        fortune_reveal_outcome = bool(
            request.data.get("fortune_reveal_outcome", False)
        )
        fortune_public_label = str(
            request.data.get("fortune_public_label", "") or ""
        ).strip()
        roll_type = request.data.get("roll_type", "ACTION")
        npc_heal_fortune = _as_bool(request.data.get("npc_heal_fortune"))
        npc_heal_coin_remaining = None
        bonus_dice = int(request.data.get("bonus_dice") or 0)
        heritage_penalty_dice = int(request.data.get("heritage_penalty_dice") or 0)
        if heritage_penalty_dice < 0:
            heritage_penalty_dice = 0
        if heritage_penalty_dice > 3:
            heritage_penalty_dice = 3
        ability_effect_steps = int(request.data.get("ability_effect_steps") or 0)
        goal_label = (request.data.get("goal_label") or "").strip()
        ability_bonuses = request.data.get(
            "ability_bonuses"
        )  # optional list for audit string
        heritage_bonuses_raw = request.data.get("heritage_bonuses")
        pool_source = str(request.data.get("pool_source") or "action_dots").strip().lower()
        stand_stat_requested = str(request.data.get("stand_stat") or "").strip().lower()
        group_action_id = request.data.get("group_action_id")
        assist_helper_id_raw = request.data.get("assist_helper_id")
        assist_helper = None
        extra_roll_stress = 0

        def _normalize_source_rows(raw, fallback_kind):
            out = []
            if raw in (None, "", False):
                return out
            rows = raw if isinstance(raw, list) else [raw]
            for row in rows:
                item = None
                if isinstance(row, str):
                    name = row.strip()
                    if name:
                        item = {
                            "kind": fallback_kind,
                            "name": name[:160],
                        }
                elif isinstance(row, dict):
                    kind = str(row.get("kind") or fallback_kind).strip().lower()
                    if not kind:
                        kind = fallback_kind
                    name = str(row.get("name") or "").strip()
                    delta = str(row.get("delta") or "").strip()
                    category = str(row.get("category") or "").strip().lower()
                    timing = str(row.get("timing") or "").strip().lower()
                    notes = str(row.get("notes") or "").strip()
                    item = {"kind": kind[:64]}
                    if name:
                        item["name"] = name[:160]
                    if delta:
                        item["delta"] = delta[:80]
                    if category:
                        item["category"] = category[:64]
                    if timing:
                        item["timing"] = timing[:64]
                    if notes:
                        item["notes"] = notes[:300]
                if item:
                    out.append(item)
            return out[:64]

        modifier_sources = _normalize_source_rows(
            request.data.get("modifier_sources"), "modifier"
        )
        modifier_sources += _normalize_source_rows(
            request.data.get("resistance_sources"), "resistance"
        )
        stress_sources = _normalize_source_rows(request.data.get("stress_sources"), "stress")
        position_effect_sources = _normalize_source_rows(
            request.data.get("position_effect_sources"), "position_effect"
        )

        stress_cost = 0
        ripple_mark_character_key = None
        session = None
        if session_id:
            try:
                session = Session.objects.get(id=session_id)
                if character.campaign_id != session.campaign_id:
                    return Response(
                        {"error": "Session must belong to character's campaign."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except Session.DoesNotExist:
                session = None

        recovery_ctx_sheet = (
            request.data.get("recovery_context") or ""
        ).strip().lower()
        if recovery_ctx_sheet in ("self_downtime", "self_mid_action"):
            if recovery_ctx_sheet == "self_mid_action" and not session_id:
                return Response(
                    {"error": "Mid-action recover requires an active session."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not session:
                return Response(
                    {
                        "error": (
                            "Link your campaign’s active session so this recovery appears "
                            "in Session History."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not action_name:
                return Response(
                    {"error": "Action name is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            bonus_rec = max(0, int(request.data.get("bonus_dice") or 0))
            rating_rec = action_rating_from_action_dots(
                character.action_dots, action_name
            )
            pool_rec = rating_rec + bonus_rec
            dice_for_seg = (
                [random.randint(1, 6) for _ in range(pool_rec)]
                if pool_rec > 0
                else None
            )
            (
                seg,
                dice_out,
                hi_rec,
                crit_rec,
                band_rec,
            ) = recovery_healing_clock_segments(pool_rec, dice_for_seg)
            stress_recovery = 2
            max_slots = max_stress_slots_for_character(character)
            stress_marked = max(
                0,
                min(max_slots, int(getattr(character, "stress", 0) or 0)),
            )
            free_slots = max(0, max_slots - stress_marked)
            if stress_recovery > free_slots:
                return Response(
                    {
                        "error": (
                            "Not enough empty stress boxes for self-recovery "
                            "(SRD: 2 stress)."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            mode_hr = (
                "Mid-action self-recover"
                if recovery_ctx_sheet == "self_mid_action"
                else "Downtime self-recover"
            )
            pool_note = (
                f"{rating_rec}+1 Invigorated ({pool_rec}d total)"
                if bonus_rec
                else f"{pool_rec}d"
            )
            desc_hr = (
                f"{mode_hr}: {str(action_name).upper()} ({pool_note}) rolled {band_rec} "
                f"→ +{seg} healing clock segments"
            )
            with transaction.atomic():
                character.stress = min(max_slots, stress_marked + stress_recovery)
                character.save(update_fields=["stress"])
                rh_roll = Roll.objects.create(
                    character=character,
                    session=session,
                    roll_type="OTHER",
                    action_name=action_name or "",
                    position="controlled",
                    effect="standard",
                    dice_pool=pool_rec,
                    results=dice_out,
                    outcome="PARTIAL_SUCCESS",
                    description=desc_hr,
                    goal_label="Healing clock recover",
                    rolled_by=request.user,
                    pool_action_rating=rating_rec,
                    pool_bonus_dice=bonus_rec,
                    roller_stress_spent=stress_recovery,
                    recovery_context=recovery_ctx_sheet,
                )
                RollHistory.objects.create(campaign=session.campaign, roll=rh_roll)
            return Response(
                {
                    "action": action_name,
                    "rating": rating_rec,
                    "total_dice": pool_rec,
                    "dice_results": dice_out,
                    "highest": hi_rec,
                    "position": rh_roll.position,
                    "effect": rh_roll.effect,
                    "outcome": "partial success",
                    "roll_id": rh_roll.id,
                    "stress_spent": stress_recovery,
                    "recovery_segments": seg,
                    "recovery_critical": crit_rec,
                    "recovery_band": band_rec,
                }
            )

        position = normalize_position(request.data.get("position"))
        effect = normalize_effect(request.data.get("effect") or "standard")
        if session and roll_type.upper() == "ACTION":
            pe_map = getattr(session, "position_effect_by_character", None) or {}
            if not isinstance(pe_map, dict):
                pe_map = {}
            key = str(character.id)
            entry = pe_map.get(key) or pe_map.get(character.id)
            if isinstance(entry, dict) and entry:
                position = normalize_position(
                    entry.get("position") or session.default_position
                )
                effect = normalize_effect(
                    entry.get("effect") or session.default_effect
                )
            else:
                position = normalize_position(session.default_position)
                effect = normalize_effect(session.default_effect)
            gl_map = getattr(session, "roll_goal_by_character", None) or {}
            if not isinstance(gl_map, dict):
                gl_map = {}
            gl = (
                str(gl_map.get(str(character.id)) or gl_map.get(character.id) or "").strip()
                or (getattr(session, "roll_goal_label", None) or "").strip()
            )
            if gl and not goal_label:
                goal_label = gl

        # Fortune roll: GM sets dice_pool directly; no action/incapacitated/push
        if roll_type.upper() == "FORTUNE":
            if npc_heal_fortune and not session:
                return Response(
                    {
                        "error": (
                            "npc_heal_fortune requires a valid session_id for this "
                            "character's campaign."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            action_name = action_name or "Fortune"
            base_fortune = max(1, min(6, int(request.data.get("dice_pool", 2))))
            dice_pool = base_fortune
            action_rating = 0
            attribute_dice = 0
            if npc_heal_fortune:
                if character.user_id != request.user.id and not request.user.is_staff:
                    return Response(
                        {
                            "error": (
                                "Only that character's player may spend coin on this "
                                "NPC heal fortune roll."
                            )
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )
                try:
                    healer_npc_id = int(request.data.get("npc_healer_npc_id") or 0)
                except (TypeError, ValueError):
                    healer_npc_id = 0
                if healer_npc_id <= 0:
                    return Response(
                        {"error": "npc_healer_npc_id is required for npc_heal_fortune."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not session.npcs_involved.filter(pk=healer_npc_id).exists():
                    return Response(
                        {
                            "error": (
                                "That NPC is not involved in this session; the GM must "
                                "add them to the session first."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                healer_npc = (
                    NPC.objects.filter(
                        pk=healer_npc_id, campaign_id=character.campaign_id
                    )
                    .only("id", "name")
                    .first()
                )
                if not healer_npc:
                    return Response(
                        {"error": "NPC healer not found in this campaign."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                pch_raw = request.data.get("npc_heal_patient_character_id")
                if pch_raw not in (None, "", False):
                    try:
                        pcid_chk = int(pch_raw)
                    except (TypeError, ValueError):
                        pcid_chk = 0
                    if pcid_chk > 0 and not Character.objects.filter(
                        pk=pcid_chk, campaign_id=character.campaign_id
                    ).exists():
                        return Response(
                            {
                                "error": (
                                    "npc_heal_patient_character_id must be a character "
                                    "in this campaign."
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                pnpc_raw_pre = request.data.get("npc_heal_patient_npc_id")
                if pnpc_raw_pre not in (None, "", False):
                    try:
                        pnid_chk = int(pnpc_raw_pre)
                    except (TypeError, ValueError):
                        pnid_chk = 0
                    if pnid_chk > 0 and not session.npcs_involved.filter(
                        pk=pnid_chk
                    ).exists():
                        return Response(
                            {
                                "error": (
                                    "npc_heal_patient_npc_id must refer to an NPC "
                                    "involved in this session."
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                try:
                    coin_n = int(request.data.get("npc_heal_fortune_coin") or 0)
                except (TypeError, ValueError):
                    coin_n = 0
                coin_n = max(0, min(3, coin_n))
                bump = coin_n

                def _personal_coin_filled_count(ch):
                    bx = getattr(ch, "coin_boxes", None) or []
                    if not isinstance(bx, (list, tuple)):
                        return 0
                    return sum(1 for x in bx[:4] if x)

                if coin_n > 0:
                    with transaction.atomic():
                        locked = Character.objects.select_for_update().get(
                            pk=character.pk
                        )
                        boxes = list(locked.coin_boxes or [])
                        if not isinstance(boxes, list):
                            boxes = []
                        while len(boxes) < 4:
                            boxes.append(False)
                        boxes = [bool(x) for x in boxes[:4]]
                        cur_coin = sum(1 for x in boxes if x)
                        if cur_coin < coin_n:
                            return Response(
                                {
                                    "error": "Insufficient personal coin for this spend.",
                                },
                                status=status.HTTP_400_BAD_REQUEST,
                            )
                        filled_indices = [i for i, v in enumerate(boxes) if v]
                        for j in filled_indices[-coin_n:]:
                            boxes[j] = False
                        locked.coin_boxes = boxes
                        locked.save(update_fields=["coin_boxes"])
                        character.coin_boxes = boxes
                    modifier_sources.append(
                        {
                            "kind": "coin",
                            "name": (
                                f"Coin: spent {coin_n} → +{coin_n}d NPC heal fortune "
                                f"(base {base_fortune}d)"
                            ),
                            "delta": f"+{coin_n}d",
                            "category": "system",
                        }
                    )
                npc_heal_coin_remaining = _personal_coin_filled_count(character)
                dice_pool = max(1, min(6, base_fortune + bump))
                healer_label = (getattr(healer_npc, "name", None) or "").strip() or "NPC"
                modifier_sources.append(
                    {
                        "kind": "npc_healer",
                        "name": f"Healer (session NPC): {healer_label}",
                        "delta": "fortune",
                        "category": "system",
                    }
                )
        else:
            if npc_heal_fortune:
                return Response(
                    {"error": "npc_heal_fortune is only valid for roll_type FORTUNE."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not action_name:
                return Response(
                    {"error": "Action name is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if sum([push_effect, push_dice, devil_bargain_dice]) > 1:
                return Response(
                    {
                        "error": (
                            "Choose only one of: push for +1 effect, push for +1d, "
                            "or devil's bargain."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Incapacitated (level 3 harm): pay 2 stress to act, no push bonus.
            incapacitated = getattr(character, "harm_level3_used", False)
            if incapacitated and (push_effect or push_dice):
                return Response(
                    {
                        "error": (
                            "Incapacitated (level 3 harm): acting costs 2 stress and "
                            "does not grant +1 effect or +1d."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if incapacitated:
                stress_cost += 2
                stress_sources.append(
                    {
                        "kind": "system",
                        "name": "Incapacitated action cost",
                        "delta": "+2 stress",
                        "category": "system",
                    }
                )

            # Devil's bargain: GM may set per-character text; player must confirm before +1d
            if session and devil_bargain_dice:
                gm_map = getattr(session, "devils_bargain_by_character", None) or {}
                if not isinstance(gm_map, dict):
                    gm_map = {}
                gm_text = (gm_map.get(str(character.pk)) or "").strip()
                if gm_text:
                    if not devil_bargain_confirmed:
                        return Response(
                            {
                                "error": "Confirm the GM's devil's bargain consequence before rolling."
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    devil_bargain_note = gm_text
                elif not (devil_bargain_note or "").strip():
                    return Response(
                        {
                            "error": (
                                "Describe the devil's bargain consequence, or ask your GM to set one "
                                "for your character in the active session."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Optional push costs 2 stress each (in addition to incapacitated cost, if any)
            if push_effect:
                stress_cost += 2
                stress_sources.append(
                    {
                        "kind": "push",
                        "name": "Push for effect",
                        "delta": "+2 stress",
                        "category": "system",
                    }
                )
            if push_dice:
                stress_cost += 2
                stress_sources.append(
                    {
                        "kind": "push",
                        "name": "Push for dice",
                        "delta": "+2 stress",
                        "category": "system",
                    }
                )
            # Optional ability-linked spend (e.g. Phantom Pain: 1 stress to attack through cover).
            try:
                extra_roll_stress_raw = int(request.data.get("extra_roll_stress") or 0)
            except (TypeError, ValueError):
                extra_roll_stress_raw = 0
            extra_roll_stress = max(0, min(6, extra_roll_stress_raw))
            if roll_type.upper() == "ACTION" and extra_roll_stress > 0:
                stress_cost += extra_roll_stress
                stress_sources.append(
                    {
                        "kind": "ability",
                        "name": "Extra roll stress",
                        "delta": f"+{extra_roll_stress} stress",
                        "category": "system",
                    }
                )
            ripple_free_push_claim = _as_bool(
                request.data.get("ripple_breathing_free_push", False)
            )
            if ripple_free_push_claim:
                if pool_source == "stand_coin":
                    return Response(
                        {
                            "error": (
                                "Ripple Breathing does not apply to stand coin rolls."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if roll_type.upper() != "ACTION":
                    return Response(
                        {
                            "error": (
                                "Ripple Breathing free push applies only on action rolls."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not session:
                    return Response(
                        {
                            "error": (
                                "Ripple Breathing free push requires an active session "
                                "(tracked once per session per character)."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not (push_effect or push_dice):
                    return Response(
                        {
                            "error": (
                                "Ripple Breathing waives stress only when you push for "
                                "+1 effect or push for +1d."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                claimed_map = getattr(
                    session, "ripple_breathing_free_push_claimed_by_character", None
                )
                if not isinstance(claimed_map, dict):
                    claimed_map = {}
                ck = str(character.pk)
                if claimed_map.get(ck):
                    return Response(
                        {
                            "error": (
                                "Ripple Breathing free push was already used this session."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not CharacterHamonAbility.objects.filter(
                    character=character,
                    hamon_ability__name__iexact="Ripple Breathing",
                ).exists():
                    return Response(
                        {"error": "Character does not have Ripple Breathing."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                stress_cost = max(0, int(stress_cost) - 2)
                stress_sources.append(
                    {
                        "kind": "ability",
                        "name": "Ripple Breathing",
                        "delta": "-2 stress (free push, once/session)",
                        "category": "ability",
                    }
                )
                ripple_mark_character_key = ck
            # Character.stress is **marked** boxes on the track (same as sheet stressFilled),
            # not "remaining budget". Spending stress marks more boxes.
            max_slots = max_stress_slots_for_character(character)
            stress_marked = max(
                0, min(max_slots, int(getattr(character, "stress", 0) or 0))
            )
            free_slots = max(0, max_slots - stress_marked)
            if stress_cost > free_slots and not stress_overflow_accepted:
                return Response(
                    {
                        "error": (
                            f"Not enough empty stress boxes to mark for this roll. "
                            f"It costs {stress_cost} stress to mark, but only {free_slots} "
                            f"empty slot(s) remain ({stress_marked}/{max_slots} filled)."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if push_effect:
                effect = bump_effect(effect, 1)
                position_effect_sources.append(
                    {
                        "kind": "push",
                        "name": "Push for effect",
                        "delta": "+1 effect",
                        "category": "system",
                    }
                )
            if ability_effect_steps:
                effect = bump_effect(effect, ability_effect_steps)
                position_effect_sources.append(
                    {
                        "kind": "ability",
                        "name": "Ability effect modifier",
                        "delta": f"+{ability_effect_steps} effect",
                        "category": "ability",
                    }
                )

        # Get action rating from action_dots or Stand Coin grade — skip for FORTUNE
        if roll_type.upper() != "FORTUNE":
            if pool_source == "stand_coin":
                if roll_type.upper() != "ACTION":
                    return Response(
                        {
                            "error": (
                                "Stand coin dice use roll_type ACTION with "
                                "pool_source stand_coin and stand_stat "
                                "(power|speed|precision|durability)."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if stand_stat_requested not in STAND_POOL_STAT_KEYS:
                    return Response(
                        {
                            "error": (
                                "stand_stat must be power, speed, precision, "
                                "or durability when pool_source is stand_coin."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                action_rating = stand_action_rating_from_character(
                    character, stand_stat_requested
                )
                action_name = (
                    request.data.get("action") or f"stand_{stand_stat_requested}"
                ).strip()
            else:
                action_rating = action_rating_from_action_dots(
                    character.action_dots, action_name
                )

            # Base action pool: action rating only (no cross-action attribute dice).
            attribute_dice = 0

            dice_pool = action_rating
            if push_dice:
                dice_pool += 1
                modifier_sources.append(
                    {
                        "kind": "push",
                        "name": "Push for dice",
                        "delta": "+1d",
                        "category": "system",
                    }
                )
            if devil_bargain_dice:
                dice_pool += 1
                modifier_sources.append(
                    {
                        "kind": "devil_bargain",
                        "name": "Devil's bargain",
                        "delta": "+1d",
                        "category": "system",
                    }
                )
            dice_pool += max(0, bonus_dice)
            if bonus_dice > 0:
                modifier_sources.append(
                    {
                        "kind": "ability",
                        "name": "Ability/heritage bonus dice",
                        "delta": f"+{bonus_dice}d",
                        "category": "ability",
                    }
                )
            if roll_type.upper() == "ACTION" and heritage_penalty_dice > 0:
                dice_pool -= heritage_penalty_dice
                modifier_sources.append(
                    {
                        "kind": "heritage",
                        "name": "Alien Understanding",
                        "delta": f"-{heritage_penalty_dice}d",
                        "category": "heritage",
                    }
                )

            ahid_requested = None
            if assist_helper_id_raw not in (None, "", False):
                try:
                    ahid_requested = int(assist_helper_id_raw)
                except (TypeError, ValueError):
                    return Response(
                        {"error": "Invalid assist_helper_id"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Forfeit pending crew-assist (+1d) when the beneficiary commits an ACTION roll without assist.
            if (
                roll_type.upper() == "ACTION"
                and session
                and ahid_requested is None
            ):
                AssistHelpPending.objects.filter(
                    session_id=session.id, recipient_id=character.id
                ).delete()

            if ahid_requested is not None:
                if roll_type.upper() != "ACTION":
                    return Response(
                        {
                            "error": (
                                "assist_helper_id is only valid when roll_type is ACTION."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not session:
                    return Response(
                        {
                            "error": (
                                "assist_helper_id requires session_id for this crew assist scene."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                with transaction.atomic():
                    pending_row = (
                        AssistHelpPending.objects.select_for_update()
                        .filter(
                            session_id=session.id,
                            recipient_id=character.id,
                        )
                        .select_related("helper")
                        .first()
                    )
                    prepaid = pending_row is not None
                    if pending_row is not None and pending_row.helper_id != ahid_requested:
                        ph = getattr(pending_row, "helper", None)
                        hn = (getattr(ph, "true_name", None) or "").strip()
                        hn = hn or (getattr(ph, "alias", None) or "").strip()
                        hn = hn or str(pending_row.helper_id)
                        return Response(
                            {
                                "error": (
                                    f"Pending crew assist is tied to {hn}. Send "
                                    f"matching assist_helper_id, or omit it on an ACTION roll "
                                    "to abandon the prepaid assist die for this pending window."
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    assist_helper = Character.objects.select_for_update().get(pk=ahid_requested)
                    if character.id == assist_helper.id:
                        return Response(
                            {"error": "Cannot help yourself"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    if (
                        character.campaign_id != assist_helper.campaign_id
                        or not character.campaign_id
                    ):
                        return Response(
                            {"error": "Characters must be in the same campaign"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    if (
                        not character.crew_id
                        or character.crew_id != assist_helper.crew_id
                    ):
                        return Response(
                            {"error": "Must be in the same crew to Help"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    hs = max(
                        0,
                        min(
                            _max_stress_for_character(assist_helper),
                            int(getattr(assist_helper, "stress", 0) or 0),
                        ),
                    )
                    helper_max_stress = _max_stress_for_character(assist_helper)
                    if not prepaid:
                        if hs >= helper_max_stress:
                            return Response(
                                {
                                    "error": (
                                        "Helper's stress track is full (cannot mark another box)."
                                    )
                                },
                                status=status.HTTP_400_BAD_REQUEST,
                            )
                        assist_helper.stress = min(helper_max_stress, hs + 1)
                        assist_helper.save(update_fields=["stress"])
                    elif prepaid:
                        AssistHelpPending.objects.filter(pk=pending_row.pk).delete()

                    dice_pool += 1
                    modifier_sources.append(
                        {
                            "kind": "assist",
                            "name": f"Assist ({assist_helper.true_name})",
                            "delta": "+1d",
                            "category": "system",
                        }
                    )

        dice_pool = max(0, dice_pool)
        pool_before_roll = dice_pool
        # 0d action pool (Blades-style): roll 2d take the lowest for outcome tiers; mirrors offline rollDice().
        if dice_pool > 0:
            dice_results = [random.randint(1, 6) for _ in range(dice_pool)]
        else:
            d1 = random.randint(1, 6)
            d2 = random.randint(1, 6)
            dice_results = [d1, d2]

        # action_rating: dots in rolled action only (Fortune path sets 0 above).
        ar_for_tier = (
            action_rating if roll_type.upper() != "FORTUNE" else 0
        )
        outcome = outcome_from_action_roll(
            dice_results, pool_before_roll, ar_for_tier
        )
        max_result = tier_die_from_action_pool(
            dice_results, pool_before_roll, ar_for_tier
        )

        # Mark stress boxes for push / incapacity / ability spends (filled count increases).
        if stress_cost > 0:
            max_slots = max_stress_slots_for_character(character)
            cur = max(0, min(max_slots, int(getattr(character, "stress", 0) or 0)))
            character.stress = min(max_slots, cur + stress_cost)
            character.save(update_fields=["stress"])

        roll = None
        xp_awarded = 0
        xp_track = None
        if session:
            desc = f"{action_name} roll"
            if devil_bargain_note:
                desc += f" [Devil's bargain: {devil_bargain_note}]"
            if assist_helper:
                desc += f" [Assist: {assist_helper.true_name}]"
            if ability_bonuses and isinstance(ability_bonuses, list):
                desc += f" [Abilities: {ability_bonuses}]"
            elif isinstance(ability_bonuses, str) and ability_bonuses.strip():
                desc += f" [Abilities: {ability_bonuses.strip()}]"
            _hb_aud = heritage_bonus_labels(heritage_bonuses_raw)
            if _hb_aud:
                desc += f" [Heritage: {', '.join(_hb_aud)}]"
            recovery_roll_target = None
            recovery_ctx_for_roll = ""
            rtc_raw = request.data.get("recovery_target_character_id")
            if npc_heal_fortune:
                recovery_ctx_for_roll = "npc_heal_fortune"
                pchar_raw = request.data.get("npc_heal_patient_character_id")
                if pchar_raw not in (None, "", False):
                    try:
                        tid_rtc = int(pchar_raw)
                        cand = Character.objects.filter(
                            pk=tid_rtc, campaign_id=character.campaign_id
                        ).first()
                        if cand:
                            if cand.id != character.id:
                                recovery_roll_target = cand
                                desc += (
                                    " [NPC heal patient (PC): "
                                    f"{recovery_roll_target.true_name}]"
                                )
                            else:
                                desc += " [NPC heal patient (PC): self]"
                    except (TypeError, ValueError):
                        pass
                pnpc_raw = request.data.get("npc_heal_patient_npc_id")
                if pnpc_raw not in (None, "", False):
                    try:
                        pnid = int(pnpc_raw)
                    except (TypeError, ValueError):
                        pnid = 0
                    if pnid > 0:
                        if not session.npcs_involved.filter(pk=pnid).exists():
                            return Response(
                                {
                                    "error": (
                                        "npc_heal_patient_npc_id must refer to an NPC "
                                        "involved in this session."
                                    )
                                },
                                status=status.HTTP_400_BAD_REQUEST,
                            )
                        pnpc = (
                            NPC.objects.filter(
                                pk=pnid, campaign_id=character.campaign_id
                            )
                            .only("id", "name")
                            .first()
                        )
                        if pnpc:
                            pn = (getattr(pnpc, "name", None) or "").strip() or "NPC"
                            desc += f" [NPC heal patient (NPC): {pn}]"
            elif rtc_raw not in (None, "", False):
                try:
                    tid_rtc = int(rtc_raw)
                    candidate_rt = Character.objects.filter(
                        pk=tid_rtc, campaign_id=character.campaign_id
                    ).first()
                    if candidate_rt and candidate_rt.id != character.id:
                        recovery_roll_target = candidate_rt
                        recovery_ctx_for_roll = "ally"
                        desc += f" [Recovery patient: {recovery_roll_target.true_name}]"
                except (TypeError, ValueError):
                    pass
            if (
                recovery_ctx_for_roll not in ("ally", "npc_heal_fortune")
                and recovery_ctx_sheet not in ("self_downtime", "self_mid_action")
                and _as_bool(request.data.get("recovery_is_self_treatment", False))
                and rtc_raw not in (None, "", False)
            ):
                try:
                    sid_self = int(rtc_raw)
                    if sid_self == character.id:
                        recovery_ctx_for_roll = "self_treatment_roll"
                except (TypeError, ValueError):
                    pass
            ga_obj = None
            if group_action_id:
                ga_obj = GroupAction.objects.filter(
                    id=group_action_id, session=session, status="OPEN"
                ).first()
                if not ga_obj:
                    return Response(
                        {"error": "Invalid or closed group action."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if (
                    roll_type.upper() == "ACTION"
                    and (ga_obj.action_name or "").strip()
                    and (action_name or "").strip().lower()
                    != (ga_obj.action_name or "").strip().lower()
                ):
                    return Response(
                        {
                            "error": (
                                f"This group action requires {ga_obj.action_name.upper()} rolls."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            if roll_type.upper() == "FORTUNE":
                rp_ar = rp_ad = 0
                rp_pe = rp_pd = False
                rp_devil = False
                rp_assist = 0
                rp_bonus = 0
                rp_stress = 0
                rp_devil_txt = ""
            else:
                rp_ar = action_rating
                # Historical rolls may have pool_attribute_dice > 0; new rolls use 0
                # (action pool = action rating only, not other actions in attribute).
                rp_ad = attribute_dice
                rp_pe = push_effect
                rp_pd = push_dice
                rp_devil = bool(devil_bargain_dice)
                rp_assist = 1 if assist_helper else 0
                rp_bonus = max(0, bonus_dice)
                rp_stress = stress_cost
                rp_devil_txt = (
                    (devil_bargain_note or "").strip() if devil_bargain_dice else ""
                )

            roll = Roll.objects.create(
                character=character,
                session=session,
                roll_type=roll_type,
                action_name=action_name or "",
                position=position,
                effect=effect,
                dice_pool=dice_pool,
                results=dice_results,
                outcome=outcome,
                description=desc,
                goal_label=goal_label or "",
                group_action=ga_obj,
                rolled_by=request.user,
                pool_action_rating=rp_ar,
                pool_attribute_dice=rp_ad,
                push_for_effect=rp_pe,
                push_for_dice=rp_pd,
                uses_devil_bargain=rp_devil,
                pool_assist_dice=rp_assist,
                pool_bonus_dice=rp_bonus,
                roller_stress_spent=rp_stress,
                modifier_sources=modifier_sources,
                stress_sources=stress_sources,
                position_effect_sources=position_effect_sources,
                devil_bargain_consequence=rp_devil_txt,
                fortune_reveal_outcome=(
                    fortune_reveal_outcome if roll_type.upper() == "FORTUNE" else False
                ),
                fortune_public_label=(
                    fortune_public_label if roll_type.upper() == "FORTUNE" else ""
                ),
                recovery_target=recovery_roll_target,
                recovery_context=recovery_ctx_for_roll,
            )
            RollHistory.objects.create(campaign=session.campaign, roll=roll)

            if ripple_mark_character_key:
                cmap = getattr(
                    session, "ripple_breathing_free_push_claimed_by_character", None
                )
                if not isinstance(cmap, dict):
                    cmap = {}
                cmap = dict(cmap)
                cmap[str(ripple_mark_character_key)] = True
                Session.objects.filter(pk=session.pk).update(
                    ripple_breathing_free_push_claimed_by_character=cmap
                )
                session.ripple_breathing_free_push_claimed_by_character = cmap

            if (
                position == "desperate"
                and roll_type.upper() == "ACTION"
                and action_name
            ):
                xp_awarded, xp_track = award_desperate_action_xp(
                    character, session, roll, action_name, request.user
                )

            if roll_type.upper() == "ACTION":
                award_heritage_expression_xp(
                    character, session, roll, heritage_bonuses_raw
                )

        roll_response_body = {
            "action": action_name,
            "rating": action_rating,
            "attribute_dice": attribute_dice,
            "total_dice": dice_pool,
            "dice_results": dice_results,
            "highest": max_result,
            "position": position,
            "effect": effect,
            "outcome": outcome.lower().replace("_", " "),
            "roll_id": roll.id if roll else None,
            "stress_spent": stress_cost,
            "xp_gained": xp_awarded if session else 0,
            "xp_track": xp_track,
            "group_action_id": roll.group_action_id if roll else None,
            "assist_helper_id": assist_helper.id if assist_helper else None,
            "assist_helper_stress": assist_helper.stress if assist_helper else None,
            "modifier_sources": modifier_sources,
            "stress_sources": stress_sources,
            "position_effect_sources": position_effect_sources,
        }
        if npc_heal_coin_remaining is not None:
            roll_response_body["coin"] = npc_heal_coin_remaining
        return Response(roll_response_body)

    @action(detail=True, methods=["post"], url_path="assist-help")
    def assist_help(self, request, pk=None):
        """Crew Assist: beneficiary is URL character; helper spends 1 stress; at most one pending +1d per beneficiary per active session."""
        actor = self.get_object()
        helper_id = request.data.get("helper_character_id")
        session_raw = request.data.get("session_id")
        if not helper_id:
            return Response(
                {"error": "helper_character_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if session_raw in (None, "", False):
            return Response(
                {"error": "session_id is required (campaign active scene)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            sess_id_body = int(session_raw)
        except (TypeError, ValueError):
            return Response(
                {"error": "Invalid session_id"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            helper = Character.objects.get(pk=int(helper_id))
        except (TypeError, ValueError):
            return Response(
                {"error": "Invalid helper_character_id"}, status=status.HTTP_400_BAD_REQUEST
            )
        except Character.DoesNotExist:
            return Response(
                {"error": "Helper not found"}, status=status.HTTP_404_NOT_FOUND
            )

        cam = getattr(actor, "campaign", None)
        if not cam:
            return Response(
                {"error": "Beneficiary character has no campaign."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        active_sid = getattr(cam, "active_session_id", None)
        if not active_sid:
            return Response(
                {"error": "Campaign has no active session for crew assists."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if sess_id_body != active_sid:
            return Response(
                {"error": "session_id must be your campaign's active session."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            session_obj = Session.objects.get(pk=sess_id_body, campaign_id=cam.id)
        except Session.DoesNotExist:
            return Response(
                {"error": "Session not found or not part of this campaign."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if actor.id == helper.id:
            return Response(
                {"error": "Cannot help yourself"}, status=status.HTTP_400_BAD_REQUEST
            )
        if actor.campaign_id != helper.campaign_id or not actor.campaign_id:
            return Response(
                {"error": "Characters must be in the same campaign"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not actor.crew_id or actor.crew_id != helper.crew_id:
            return Response(
                {"error": "Must be in the same crew to Help"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            if AssistHelpPending.objects.select_for_update().filter(
                session_id=session_obj.id, recipient_id=actor.id
            ).exists():
                return Response(
                    {
                        "error": (
                            "This PC already has a pending crew assist for this session; "
                            "resolve it by rolling before another assist grants +1d."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            hs = max(
                0,
                min(
                    _max_stress_for_character(helper),
                    int(getattr(helper, "stress", 0) or 0),
                ),
            )
            helper_max_stress = _max_stress_for_character(helper)
            if hs >= helper_max_stress:
                return Response(
                    {
                        "error": (
                            "Helper's stress track is full (cannot mark another box)."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            lock_helper = Character.objects.select_for_update().get(pk=helper.id)
            lock_helper.stress = min(
                helper_max_stress,
                max(
                    0,
                    min(
                        helper_max_stress,
                        int(getattr(lock_helper, "stress", 0) or 0),
                    ),
                )
                + 1,
            )
            lock_helper.save(update_fields=["stress"])
            AssistHelpPending.objects.create(
                session=session_obj,
                recipient_id=actor.id,
                helper_id=helper.id,
            )

        helper.refresh_from_db()
        return Response(
            {
                "recipient_id": actor.id,
                "session_id": session_obj.id,
                "helper_id": helper.id,
                "helper_name": helper.true_name,
                "helper_stress": helper.stress,
            }
        )

    @action(detail=True, methods=["post"], url_path="indulge-vice")
    def indulge_vice(self, request, pk=None):
        """Indulge in vice to recover stress."""
        character = self.get_object()

        # Check if character has stress to recover
        if character.stress == 0:
            return Response(
                {"error": "No stress to recover"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Recover stress (simplified - you'd implement actual vice mechanics)
        stress_recovered = min(2, character.stress)  # Recover up to 2 stress
        character.stress -= stress_recovered
        character.save()

        return Response(
            {
                "message": f"Recovered {stress_recovered} stress",
                "stress_recovered": stress_recovered,
                "current_stress": character.stress,
            }
        )

    @action(detail=True, methods=["post"], url_path="take-harm")
    def take_harm(self, request, pk=None):
        """Take harm and apply consequences."""
        character = self.get_object()
        harm_level = request.data.get("level")  # 'lesser', 'moderate', 'severe'
        harm_type = request.data.get("type", "physical")
        description = request.data.get("description", "")

        if not harm_level:
            return Response(
                {"error": "Harm level is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Apply harm (simplified - you'd implement actual harm mechanics)
        harm_mapping = {"lesser": 1, "moderate": 2, "severe": 3}

        harm_value = harm_mapping.get(harm_level, 1)

        # Update character harm (you'd need to add harm fields to your model)
        # This is a simplified example
        return Response(
            {
                "message": f"Took {harm_level} {harm_type} harm",
                "harm_level": harm_level,
                "harm_type": harm_type,
                "description": description,
            }
        )

    @action(detail=True, methods=["post"], url_path="heal-harm")
    def heal_harm(self, request, pk=None):
        """Heal harm through recovery actions."""
        character = self.get_object()
        harm_level = request.data.get("level")
        harm_type = request.data.get("type", "physical")

        if not harm_level:
            return Response(
                {"error": "Harm level is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Heal harm (simplified - you'd implement actual healing mechanics)
        return Response(
            {
                "message": f"Healed {harm_level} {harm_type} harm",
                "harm_level": harm_level,
                "harm_type": harm_type,
            }
        )

    @action(detail=True, methods=["post"], url_path="log-armor-expenditure")
    def log_armor_expenditure(self, request, pk=None):
        """Log armor expenditure to reduce harm."""
        character = self.get_object()
        armor_type = request.data.get(
            "type", "regular"
        )  # 'regular', 'special', 'resistance'
        harm_reduced = request.data.get("harm_reduced", 1)

        # Log armor expenditure (simplified - you'd implement actual armor mechanics)
        return Response(
            {
                "message": f"Used {armor_type} armor to reduce harm by {harm_reduced}",
                "armor_type": armor_type,
                "harm_reduced": harm_reduced,
            }
        )

    @action(detail=True, methods=["get"], url_path="xp-allocations")
    def xp_allocations(self, request, pk=None):
        """List reversible XP spend allocations for this character."""
        character = self.get_object()
        include_undone = request.query_params.get("include_undone") == "true"
        qs = list_allocations(character, include_undone=include_undone)
        latest = list_allocations(character).first()
        latest_undone = (
            CharacterXPAllocation.objects.filter(
                character=character, undone_at__isnull=False
            )
            .order_by("-undone_at", "-id")
            .first()
            if include_undone
            else None
        )
        serializer = CharacterXPAllocationSerializer(
            qs,
            many=True,
            context={
                "latest_undoable_allocation_id": latest.id if latest else None,
                "latest_redoable_allocation_id": (
                    latest_undone.id if latest_undone else None
                ),
            },
        )
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="apply-level-up")
    def apply_level_up_action(self, request, pk=None):
        character = self.get_object()
        if not _user_may_edit_character(request.user, character):
            raise PermissionDenied("You cannot advance this character.")

        try:
            token = bind_character_history_editor(request.user)
            try:
                allocation = apply_level_up(
                    character,
                    xp_track=request.data.get("xp_track"),
                    choice=request.data.get("choice"),
                    stand_stat=request.data.get("stand_stat"),
                    actions=request.data.get("actions"),
                    reward=request.data.get("reward"),
                )
            finally:
                reset_character_history_editor(token)
        except XPAllocationError as exc:
            return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        character.refresh_from_db()
        return Response(
            {
                "success": True,
                "allocation": CharacterXPAllocationSerializer(
                    allocation,
                    context={
                        "latest_undoable_allocation_id": allocation.id,
                    },
                ).data,
                "character": _character_response(character),
                "allocations": _allocation_list_response(character),
            }
        )

    @action(detail=True, methods=["post"], url_path="apply-minor-advance")
    def apply_minor_advance_action(self, request, pk=None):
        character = self.get_object()
        if not _user_may_edit_character(request.user, character):
            raise PermissionDenied("You cannot advance this character.")

        try:
            token = bind_character_history_editor(request.user)
            try:
                allocation = apply_minor_advance(
                    character,
                    xp_track=request.data.get("xp_track"),
                    action=request.data.get("action"),
                )
            finally:
                reset_character_history_editor(token)
        except XPAllocationError as exc:
            return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        character.refresh_from_db()
        return Response(
            {
                "success": True,
                "allocation": CharacterXPAllocationSerializer(
                    allocation,
                    context={
                        "latest_undoable_allocation_id": allocation.id,
                    },
                ).data,
                "character": _character_response(character),
                "allocations": _allocation_list_response(character),
            }
        )

    @action(detail=True, methods=["post"], url_path="undo-latest-allocation")
    def undo_latest_allocation_action(self, request, pk=None):
        character = self.get_object()
        if not _user_may_edit_character(request.user, character):
            raise PermissionDenied("You cannot undo allocations for this character.")

        allocation = (
            list_allocations(character).order_by("-created_at", "-id").first()
        )
        if not allocation:
            return Response(
                {"error": "No XP allocation to undo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            undo_allocation(character, allocation, user=request.user)
        except XPAllocationError as exc:
            return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        character.refresh_from_db()
        return Response(
            {
                "success": True,
                "undone_allocation_id": allocation.id,
                "character": _character_response(character),
                "allocations": _allocation_list_response(character),
            }
        )

    @action(detail=True, methods=["get"], url_path="gm-undo-status")
    def gm_undo_status_action(self, request, pk=None):
        """Whether this GM can undo their most recent edit on a player's PC."""
        character = self.get_object()
        status_payload = gm_undo_status(character, request.user)
        return Response(status_payload)

    @action(detail=True, methods=["post"], url_path="undo-latest-gm-change")
    def undo_latest_gm_change_action(self, request, pk=None):
        """Revert the campaign GM's most recent change to this player's character."""
        character = self.get_object()
        try:
            result = undo_latest_gm_change(character, gm_user=request.user)
        except CharacterHistoryUndoError as exc:
            return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        character.refresh_from_db()
        return Response(
            {
                "success": True,
                "character": _character_response(character),
                "allocations": _allocation_list_response(character),
                **result,
            }
        )

    @action(detail=True, methods=["get"], url_path="gm-redo-status")
    def gm_redo_status_action(self, request, pk=None):
        character = self.get_object()
        return Response(gm_redo_status(character, request.user))

    @action(detail=True, methods=["post"], url_path="redo-latest-gm-change")
    def redo_latest_gm_change_action(self, request, pk=None):
        character = self.get_object()
        try:
            result = redo_latest_gm_change(character, gm_user=request.user)
        except CharacterHistoryUndoError as exc:
            return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        character.refresh_from_db()
        return Response(
            {
                "success": True,
                "character": _character_response(character),
                "allocations": _allocation_list_response(character),
                **result,
            }
        )

    @action(detail=True, methods=["post"], url_path="redo-latest-allocation")
    def redo_latest_allocation_action(self, request, pk=None):
        character = self.get_object()
        if not _user_may_edit_character(request.user, character):
            raise PermissionDenied("You cannot redo allocations for this character.")

        allocation = (
            CharacterXPAllocation.objects.filter(
                character=character, undone_at__isnull=False
            )
            .order_by("-undone_at", "-id")
            .first()
        )
        if not allocation:
            return Response(
                {"error": "No undone allocation to redo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            redo_allocation(character, allocation, user=request.user)
        except XPAllocationError as exc:
            return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        character.refresh_from_db()
        return Response(
            {
                "success": True,
                "redone_allocation_id": allocation.id,
                "character": _character_response(character),
                "allocations": _allocation_list_response(character),
            }
        )

    @action(detail=True, methods=["post"], url_path="remove-allocation-result")
    def remove_allocation_result(self, request, pk=None):
        """Undo a specific allocation (must be the latest non-undone spend)."""
        character = self.get_object()
        if not _user_may_edit_character(request.user, character):
            raise PermissionDenied("You cannot undo allocations for this character.")

        raw_id = request.data.get("allocation_id")
        try:
            allocation_id = int(raw_id)
        except (TypeError, ValueError):
            return Response(
                {"error": "allocation_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allocation = CharacterXPAllocation.objects.filter(
            pk=allocation_id, character=character
        ).first()
        if not allocation:
            return Response(
                {"error": "Allocation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            undo_allocation(character, allocation, user=request.user)
        except XPAllocationError as exc:
            return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        character.refresh_from_db()
        return Response(
            {
                "success": True,
                "undone_allocation_id": allocation.id,
                "character": _character_response(character),
                "allocations": _allocation_list_response(character),
            }
        )

    @action(detail=True, methods=["post"], url_path="add-xp")
    def add_xp(self, request, pk=None):
        """Add XP to a character's BitD-style tracks (xp_clocks) and log an ExperienceTracker row."""
        character = self.get_object()
        user = request.user
        is_owner = character.user_id == user.id
        is_gm = bool(
            character.campaign_id and character.campaign.gm_id == user.id
        )
        if not (user.is_staff or is_owner or is_gm):
            raise PermissionDenied(
                "You may only add XP for your own character or as the campaign GM."
            )

        track = request.data.get("track") or request.data.get("xp_type")
        if not track or not isinstance(track, str):
            return Response(
                {"error": "XP track is required (xp_type or track)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        track = track.strip().lower()
        valid_tracks = ["insight", "prowess", "resolve", "heritage", "playbook"]
        if track not in valid_tracks:
            return Response(
                {
                    "error": (
                        "Invalid track. Use one of: "
                        + ", ".join(valid_tracks)
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount = int(request.data.get("amount", 1))
        except (TypeError, ValueError):
            return Response(
                {"error": "amount must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if amount < 1 or amount > 20:
            return Response(
                {"error": "XP amount must be between 1 and 20 per award."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        description = (
            request.data.get("description")
            or request.data.get("reason")
            or ""
        ).strip()
        if len(description) < 3:
            description = "Manual XP award"

        session_obj = None
        session_raw = request.data.get("session") or request.data.get(
            "session_id"
        )
        if session_raw not in (None, "", False):
            try:
                sid = int(session_raw)
            except (TypeError, ValueError):
                return Response(
                    {"error": "Invalid session id"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not character.campaign_id:
                return Response(
                    {
                        "error": (
                            "Character has no campaign; cannot attach "
                            "this XP to a session."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            session_obj = Session.objects.filter(
                id=sid, campaign_id=character.campaign_id
            ).first()
            if not session_obj:
                return Response(
                    {"error": "Session not found for this character's campaign."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        xp_clocks = dict(character.xp_clocks or {})
        current = int(xp_clocks.get(track, 0) or 0)
        new_xp = current + amount
        if track == "playbook" and new_xp > 10:
            return Response(
                {"error": "Playbook track cannot exceed 10 XP."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        xp_clocks[track] = new_xp

        with transaction.atomic():
            token = bind_character_history_editor(user)
            try:
                serializer = CharacterSerializer(
                    character, data={"xp_clocks": xp_clocks}, partial=True
                )
                if not serializer.is_valid():
                    return Response(
                        {"error": "Failed to add XP", "errors": serializer.errors},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                serializer.save()
            finally:
                reset_character_history_editor(token)
            tracker = ExperienceTracker.objects.create(
                character=character,
                session=session_obj,
                roll=None,
                trigger="MANUAL",
                description=f"[{track}] {description}",
                xp_gained=amount,
                awarded_by=user,
                award_source=(
                    "GM"
                    if (is_gm and not is_owner)
                    else ("PLAYER" if is_owner else "GM")
                ),
                clock_key=track,
            )

        return Response(
            {
                "success": True,
                "track": track,
                "amount": amount,
                "new_total": new_xp,
                "xp_clocks": xp_clocks,
                "experience_tracker_id": tracker.id,
                "message": f"Added {amount} XP to {track} track",
            }
        )

    @action(detail=True, methods=["post"], url_path="add-progress-clock")
    def add_progress_clock(self, request, pk=None):
        """Add a progress clock to a character."""
        character = self.get_object()
        name = request.data.get("name")
        segments = request.data.get("segments", 4)
        description = request.data.get("description", "")

        if not name:
            return Response(
                {"error": "Clock name is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Add progress clock (simplified - you'd implement actual clock mechanics)
        return Response(
            {
                "message": f"Added progress clock: {name}",
                "name": name,
                "segments": segments,
                "description": description,
            }
        )

    @action(detail=True, methods=["post"], url_path="update-progress-clock")
    def update_progress_clock(self, request, pk=None):
        """Update a progress clock on a character."""
        character = self.get_object()
        clock_name = request.data.get("name")
        ticks = request.data.get("ticks", 1)

        if not clock_name:
            return Response(
                {"error": "Clock name is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Update progress clock (simplified - you'd implement actual clock mechanics)
        return Response(
            {
                "message": f"Updated progress clock: {clock_name}",
                "name": clock_name,
                "ticks_added": ticks,
            }
        )

    @action(detail=False, methods=["post"], url_path="create-template")
    def create_template(self, request):
        """Create a character template for quick character creation."""
        template_data = request.data

        # Validate template data
        required_fields = ["name", "heritage", "vice"]
        for field in required_fields:
            if field not in template_data:
                return Response(
                    {"error": f"Field {field} is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Create template (simplified - you'd implement actual template mechanics)
        return Response(
            {
                "message": "Character template created successfully",
                "template": template_data,
            }
        )

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        """Download a fillable PDF snapshot of this character sheet."""
        try:
            from ..services.sheet_export import export_pc_pdf
        except ImportError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        character = self.get_object()
        try:
            pdf_bytes, filename = export_pc_pdf(character)
        except ImportError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
