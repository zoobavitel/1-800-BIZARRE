import logging
from django.shortcuts import render
from django.http import JsonResponse
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
    Campaign,
    Character,
    ExperienceTracker,
    GroupAction,
    Session,
    Roll,
    RollHistory,
)
from ..parsers import MultipartJsonParser
from ..roll_helpers import (
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
    tier_die_from_action_pool,
    award_struggle_for_new_traumas,
)
from ..serializers import CharacterSerializer
from ..history_context import bind_character_history_editor, reset_character_history_editor


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
        fortune_reveal_outcome = bool(
            request.data.get("fortune_reveal_outcome", False)
        )
        fortune_public_label = str(
            request.data.get("fortune_public_label", "") or ""
        ).strip()
        roll_type = request.data.get("roll_type", "ACTION")
        bonus_dice = int(request.data.get("bonus_dice") or 0)
        ability_effect_steps = int(request.data.get("ability_effect_steps") or 0)
        goal_label = (request.data.get("goal_label") or "").strip()
        ability_bonuses = request.data.get(
            "ability_bonuses"
        )  # optional list for audit string
        heritage_bonuses_raw = request.data.get("heritage_bonuses")
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
            action_name = action_name or "Fortune"
            dice_pool = max(1, min(6, int(request.data.get("dice_pool", 2))))
            action_rating = 0
            attribute_dice = 0
        else:
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
            # Character.stress is **marked** boxes on the track (same as sheet stressFilled),
            # not "remaining budget". Spending stress marks more boxes.
            max_slots = max_stress_slots_for_character(character)
            stress_marked = max(
                0, min(max_slots, int(getattr(character, "stress", 0) or 0))
            )
            free_slots = max(0, max_slots - stress_marked)
            if stress_cost > free_slots:
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

        # Get action rating from action_dots (flat or nested) - skip for FORTUNE
        if roll_type.upper() != "FORTUNE":
            action_rating = action_rating_from_action_dots(
                character.action_dots, action_name
            )

            # Base action pool: action rating only (no extra dice from other
            # actions in the same attribute).
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

            if assist_helper_id_raw not in (None, "", False):
                try:
                    ahid = int(assist_helper_id_raw)
                except (TypeError, ValueError):
                    return Response(
                        {"error": "Invalid assist_helper_id"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                with transaction.atomic():
                    assist_helper = Character.objects.select_for_update().get(pk=ahid)
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
                    dice_pool += 1
                    modifier_sources.append(
                        {
                            "kind": "assist",
                            "name": f"Assist ({assist_helper.true_name})",
                            "delta": "+1d",
                            "category": "system",
                        }
                    )

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
            )
            RollHistory.objects.create(campaign=session.campaign, roll=roll)

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

        return Response(
            {
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
        )

    @action(detail=True, methods=["post"], url_path="assist-help")
    def assist_help(self, request, pk=None):
        """Help: another PC in the same crew spends 1 stress to assist the acting character."""
        actor = self.get_object()
        helper_id = request.data.get("helper_character_id")
        if not helper_id:
            return Response(
                {"error": "helper_character_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            helper = Character.objects.get(pk=helper_id)
        except Character.DoesNotExist:
            return Response(
                {"error": "Helper not found"}, status=status.HTTP_404_NOT_FOUND
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
        helper.stress = min(helper_max_stress, hs + 1)
        helper.save(update_fields=["stress"])
        return Response(
            {
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
            serializer = CharacterSerializer(
                character, data={"xp_clocks": xp_clocks}, partial=True
            )
            if not serializer.is_valid():
                return Response(
                    {"error": "Failed to add XP", "errors": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializer.save()
            tracker = ExperienceTracker.objects.create(
                character=character,
                session=session_obj,
                roll=None,
                trigger="MANUAL",
                description=f"[{track}] {description}",
                xp_gained=amount,
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
