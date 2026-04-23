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
from ..models import Campaign, Character, GroupAction, Session, Roll, RollHistory
from ..parsers import MultipartJsonParser
from ..roll_helpers import (
    award_desperate_action_xp,
    bump_effect,
    normalize_effect,
    normalize_position,
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
            serializer.save(user_id=original_user_id)
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
                {"name": "Speed", "description": "Movement and reaction time"},
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
        group_action_id = request.data.get("group_action_id")
        assist_helper_id_raw = request.data.get("assist_helper_id")
        assist_helper = None

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
            position = normalize_position(session.default_position)
            effect = normalize_effect(session.default_effect)
            gl = (getattr(session, "roll_goal_label", None) or "").strip()
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

            # Incapacitated (level 3 harm): must push to act
            incapacitated = getattr(character, "harm_level3_used", False)
            if incapacitated and not (push_effect or push_dice):
                return Response(
                    {
                        "error": "Incapacitated (level 3 harm). You must push yourself to take an action (2 stress for +1 effect or +1d)."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
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

            # Push costs 2 stress each
            if push_effect:
                stress_cost += 2
            if push_dice:
                stress_cost += 2
            current_stress = getattr(character, "stress", 0) or 0
            if stress_cost > current_stress:
                return Response(
                    {
                        "error": f"Not enough stress. Push costs {stress_cost} stress, you have {current_stress}."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if push_effect:
                effect = bump_effect(effect, 1)
            if ability_effect_steps:
                effect = bump_effect(effect, ability_effect_steps)

        # Get action rating from action_dots (flat or nested) - skip for FORTUNE
        if roll_type.upper() != "FORTUNE":
            action_dots = character.action_dots or {}
            action_rating = 0
            if isinstance(action_dots.get("insight"), dict):
                for group in action_dots.values():
                    if isinstance(group, dict) and action_name.lower() in group:
                        action_rating = group.get(action_name.lower(), 0) or 0
                        break
            else:
                action_rating = action_dots.get(action_name.lower(), 0) or 0

            # Attribute dice: each action in same attribute with dots > 0 adds 1
            insight_actions = ["hunt", "study", "survey", "tinker"]
            prowess_actions = ["finesse", "prowl", "skirmish", "wreck"]
            resolve_actions = ["bizarre", "command", "consort", "sway"]

            def get_dots(action):
                if isinstance(action_dots.get("insight"), dict):
                    for group in action_dots.values():
                        if isinstance(group, dict) and action in group:
                            return group.get(action, 0) or 0
                return action_dots.get(action, 0) or 0

            attr_group = (
                insight_actions
                if action_name.lower() in insight_actions
                else (
                    prowess_actions
                    if action_name.lower() in prowess_actions
                    else resolve_actions
                )
            )
            attribute_dice = len([a for a in attr_group if get_dots(a) > 0])

            dice_pool = action_rating + attribute_dice
            if push_dice:
                dice_pool += 1
            if devil_bargain_dice:
                dice_pool += 1
            dice_pool += max(0, bonus_dice)

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
                    hs = getattr(assist_helper, "stress", 0) or 0
                    if hs < 1:
                        return Response(
                            {"error": "Helper has no stress to spend"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    assist_helper.stress = hs - 1
                    assist_helper.save(update_fields=["stress"])
                    dice_pool += 1

        dice_results = (
            [random.randint(1, 6) for _ in range(max(1, dice_pool))]
            if dice_pool > 0
            else [0]
        )
        max_result = max(dice_results) if dice_results else 0

        if max_result >= 6:
            outcome = "CRITICAL_SUCCESS"
        elif max_result >= 4:
            outcome = "FULL_SUCCESS"
        elif max_result >= 1:
            outcome = "PARTIAL_SUCCESS"
        else:
            outcome = "FAILURE"

        # Deduct stress for push
        if stress_cost > 0:
            current_stress = getattr(character, "stress", 0) or 0
            character.stress = max(0, current_stress - stress_cost)
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
            ga_obj = None
            if group_action_id:
                ga_obj = GroupAction.objects.filter(
                    id=group_action_id, session=session, status="OPEN"
                ).first()
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
        hs = getattr(helper, "stress", 0) or 0
        if hs < 1:
            return Response(
                {"error": "Helper has no stress to spend"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        helper.stress = hs - 1
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
        """Add XP to a character."""
        character = self.get_object()
        amount = request.data.get("amount", 1)
        reason = request.data.get("reason", "")

        if amount <= 0:
            return Response(
                {"error": "XP amount must be positive"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Add XP (simplified - you'd implement actual XP mechanics)
        character.xp += amount
        character.save()

        return Response(
            {
                "message": f"Added {amount} XP",
                "xp_gained": amount,
                "total_xp": character.xp,
                "reason": reason,
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
