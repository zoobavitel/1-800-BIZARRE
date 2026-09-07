from django.db.models import Q
from django.db.models.functions import Lower
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from django.contrib.auth.models import User
from .models import (
    AssistHelpPending,
    UserProfile,
    Heritage,
    Vice,
    Ability,
    Character,
    CharacterXPAllocation,
    Stand,
    Campaign,
    CampaignInvitation,
    NPC,
    Crew,
    Detriment,
    Benefit,
    StandAbility,
    HamonAbility,
    SpinAbility,
    Trauma,
    CharacterHamonAbility,
    CharacterSpinAbility,
    NPCHamonAbility,
    NPCSpinAbility,
    CharacterHistory,
    ExperienceTracker,
    Session,
    SessionEvent,
    SessionNPCInvolvement,
    Claim,
    CrewPlaybook,
    CrewSpecialAbility,
    CrewUpgrade,
    XPHistory,
    StressHistory,
    ChatMessage,
    Faction,
    CrewFactionRelationship,
    CrewHistory,
    ShowcasedNPC,
    ProgressClock,
    Roll,
    GroupAction,
    CampaignAuditLog,
    EquipmentItem,
    CampaignEquipmentAccess,
)

from .services.playbook_xp_archetype import normalize_playbook_xp_archetypes
from .services.inventory import normalize_inventory_list
from .services.loadout import (
    apply_loadout_side_effects,
    merge_loadout_map,
    normalize_loadout_entry,
)

# ── NPC level computation (mirrors NPCSheet.jsx formula) ─────────────────────
_NPC_GRADE_PTS = {"F": 0, "D": 1, "C": 2, "B": 3, "A": 4, "S": 5}
_NPC_STAND_STAT_KEYS = (
    "POWER",
    "SPEED",
    "RANGE",
    "DURABILITY",
    "PRECISION",
    "DEVELOPMENT",
)
_NPC_DEFAULT_GRADE = "D"
_NPC_LEVEL_OFFSET = 9

_PC_CLOCK_TYPES = {c[0] for c in ProgressClock.CLOCK_TYPE_CHOICES}

def _attach_or_create_party_crew_from_personal_name(character):
    """Realize the personal_crew_name text field into the campaign's party Crew.

    Treats the sheet's crew text field as a player-driven "the crew exists
    now" signal: if the character is in a campaign with no crew yet, create
    one named from `personal_crew_name`. If the campaign already has a crew,
    silently attach this character to the existing party crew (FitD-style
    single-crew assumption). Either way the character becomes a crew member,
    which the CrewViewSet uses to gate write permissions on the shared sheet.

    Always clears `personal_crew_name` after a successful attach so the text
    field doesn't drift out of sync with the FK.
    """
    if not character or not character.campaign_id:
        return
    if character.crew_id:
        if character.personal_crew_name:
            Character.objects.filter(pk=character.pk).update(personal_crew_name="")
            character.personal_crew_name = ""
        return
    desired_name = (character.personal_crew_name or "").strip()
    if not desired_name:
        return
    crew = (
        Crew.objects.filter(campaign_id=character.campaign_id)
        .order_by("id")
        .first()
    )
    if crew is None:
        crew = Crew.objects.create(
            campaign_id=character.campaign_id, name=desired_name[:100]
        )
    Character.objects.filter(pk=character.pk).update(
        crew=crew, personal_crew_name=""
    )
    character.crew_id = crew.id
    character.personal_crew_name = ""

def _sync_character_progress_clocks(character, raw_clocks, user):
    """Replace character-scoped progress clocks from sheet JSON (PUT/PATCH/POST body).

    Frontend sends `progress_clocks` as a list of dicts with `segments`/`filled` or
    `max_segments`/`filled_segments`. Omitted or non-list `raw_clocks` leaves DB unchanged.
    """
    from django.db import transaction

    if raw_clocks is None or not isinstance(raw_clocks, list):
        return
    campaign_id = character.campaign_id
    kept_ids = []
    with transaction.atomic():
        for item in raw_clocks:
            if not isinstance(item, dict):
                continue
            name = (str(item.get("name") or "")).strip()[:100] or "Clock"
            max_segments = item.get("max_segments")
            if max_segments is None:
                max_segments = item.get("segments")
            try:
                max_segments = int(max_segments)
            except (TypeError, ValueError):
                max_segments = 4
            max_segments = max(1, min(12, max_segments))
            filled = item.get("filled_segments")
            if filled is None:
                filled = item.get("filled")
            try:
                filled = int(filled)
            except (TypeError, ValueError):
                filled = 0
            filled = max(0, min(max_segments, filled))
            ct = item.get("clock_type") or "COUNTDOWN"
            if ct not in _PC_CLOCK_TYPES:
                ct = "COUNTDOWN"
            vis_party = bool(item.get("visible_to_party"))
            vis_players = bool(item.get("visible_to_players"))
            desc = str(item.get("description") or "")[:5000]
            session_raw = item.get("session")
            session_id = None
            if session_raw is not None and session_raw != "":
                try:
                    session_id = int(session_raw)
                except (TypeError, ValueError):
                    session_id = None
            if session_id and campaign_id:
                if not Session.objects.filter(
                    id=session_id, campaign_id=campaign_id
                ).exists():
                    session_id = None
            elif session_id and not campaign_id:
                session_id = None

            raw_id = item.get("id")
            try:
                pk = int(raw_id)
            except (TypeError, ValueError):
                pk = None
            # Date.now() temp ids overflow 32-bit PK; treat as new rows.
            if pk is not None and pk > 2147483647:
                pk = None
            if pk and pk > 0:
                existing = ProgressClock.objects.filter(
                    id=pk, character_id=character.id
                ).first()
                if existing:
                    existing.name = name
                    existing.clock_type = ct
                    existing.max_segments = max_segments
                    existing.filled_segments = filled
                    existing.visible_to_party = vis_party
                    existing.visible_to_players = vis_players
                    existing.description = desc
                    if session_id is not None:
                        existing.session_id = session_id
                    elif item.get("session") is None:
                        existing.session_id = None
                    existing.save()
                    kept_ids.append(existing.id)
                    continue
            created_by_id = (
                user.id if getattr(user, "is_authenticated", False) else None
            )
            nu = ProgressClock.objects.create(
                name=name,
                clock_type=ct,
                max_segments=max_segments,
                filled_segments=filled,
                description=desc,
                character=character,
                campaign_id=campaign_id,
                session_id=session_id,
                visible_to_party=vis_party,
                visible_to_players=vis_players,
                created_by_id=created_by_id,
            )
            kept_ids.append(nu.id)
        qs = ProgressClock.objects.filter(character_id=character.id)
        if kept_ids:
            qs.exclude(id__in=kept_ids).delete()
        else:
            qs.delete()

def _compute_npc_level(stand_coin_stats):
    """Derive NPC level from stand_coin_stats, defaulting missing stats to 'D'."""
    scs = stand_coin_stats or {}
    total = sum(
        _NPC_GRADE_PTS.get(scs.get(key, _NPC_DEFAULT_GRADE), 0)
        for key in _NPC_STAND_STAT_KEYS
    )
    return max(1, total - _NPC_LEVEL_OFFSET)

class ClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = Claim
        fields = "__all__"

class CrewSpecialAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = CrewSpecialAbility
        fields = "__all__"

class CrewPlaybookSerializer(serializers.ModelSerializer):
    claims = ClaimSerializer(many=True, read_only=True)
    special_abilities = CrewSpecialAbilitySerializer(many=True, read_only=True)

    class Meta:
        model = CrewPlaybook
        fields = "__all__"

class CrewUpgradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrewUpgrade
        fields = "__all__"

class CrewSerializer(serializers.ModelSerializer):
    playbook = CrewPlaybookSerializer(read_only=True)
    claims = ClaimSerializer(many=True, read_only=True)
    special_abilities = CrewSpecialAbilitySerializer(many=True, read_only=True)
    proposed_by = serializers.PrimaryKeyRelatedField(read_only=True)
    approved_by = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    image = serializers.FileField(required=False)
    faction_relationships = serializers.SerializerMethodField(read_only=True)
    active_session_crew_earned_xp = serializers.SerializerMethodField(read_only=True)

    def validate_image_url(self, value):
        s = (value or "").strip()
        if not s:
            return ""
        if not s.startswith("https://"):
            raise serializers.ValidationError("Use an HTTPS image URL.")
        return s

    # Allowed inner keys for each session-id row in session_xp_triggers; mirrors
    # frontend toggle keys + the server-side `credited` flag set by the crew XP
    # trigger settlement service.
    _CREW_XP_TRIGGER_BOOL_KEYS = frozenset({"challenge", "reputation", "goals"})
    _CREW_XP_TRIGGER_ALLOWED_KEYS = _CREW_XP_TRIGGER_BOOL_KEYS | {"credited"}

    def validate_session_xp_triggers(self, value):
        """Whitelist shape: {sid_str: {challenge, reputation, goals, credited}}."""
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Expected an object keyed by session id.")
        cleaned: dict[str, dict] = {}
        for sid, row in value.items():
            sid_str = str(sid)
            try:
                int(sid_str)
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    f"session id keys must be integers, got {sid!r}."
                )
            if not isinstance(row, dict):
                raise serializers.ValidationError(
                    f"session_xp_triggers[{sid_str}] must be an object."
                )
            extra = set(row.keys()) - self._CREW_XP_TRIGGER_ALLOWED_KEYS
            if extra:
                raise serializers.ValidationError(
                    f"Unknown keys for session {sid_str}: {sorted(extra)}."
                )
            cleaned_row: dict = {}
            for k in self._CREW_XP_TRIGGER_BOOL_KEYS:
                if k in row:
                    cleaned_row[k] = bool(row[k])
            if "credited" in row:
                cleaned_row["credited"] = bool(row["credited"])
            cleaned[sid_str] = cleaned_row
        return cleaned

    def validate_session_rep_contributions(self, value):
        """Whitelist shape: {sid_str: {character_id_str: non-negative int}}."""
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Expected an object keyed by session id.")
        cleaned: dict[str, dict[str, int]] = {}
        for sid, row in value.items():
            sid_str = str(sid)
            try:
                int(sid_str)
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    f"session id keys must be integers, got {sid!r}."
                )
            if not isinstance(row, dict):
                raise serializers.ValidationError(
                    f"session_rep_contributions[{sid_str}] must be an object."
                )
            inner: dict[str, int] = {}
            for ck, cv in row.items():
                ck_str = str(ck)
                try:
                    int(ck_str)
                except (TypeError, ValueError):
                    raise serializers.ValidationError(
                        f"character id keys must be integers, got {ck!r}."
                    )
                try:
                    n = int(cv)
                except (TypeError, ValueError):
                    raise serializers.ValidationError(
                        f"session_rep_contributions[{sid_str}][{ck_str}] must be an integer."
                    )
                inner[ck_str] = max(0, n)
            cleaned[sid_str] = inner
        return cleaned

    def validate(self, attrs):
        # Written only by CrewViewSet when merging session_xp_triggers; ignore
        # any client-supplied rep contribution object.
        attrs.pop("session_rep_contributions", None)
        return super().validate(attrs)

    def get_active_session_crew_earned_xp(self, obj):
        aid = getattr(obj.campaign, "active_session_id", None)
        if not aid:
            return False
        return ExperienceTracker.objects.filter(
            character__crew_id=obj.id,
            session_id=aid,
            xp_gained__gt=0,
        ).exists()

    class Meta:
        model = Crew
        fields = [
            "id",
            "name",
            "campaign",
            "playbook",
            "description",
            "notes",
            "image",
            "image_url",
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
            "stash_slots",
            "claims",
            "upgrade_progress",
            "special_abilities",
            "proposed_name",
            "proposed_by",
            "approved_by",
            "faction_relationships",
            "session_xp_triggers",
            "session_rep_contributions",
            "active_session_crew_earned_xp",
        ]

    def get_faction_relationships(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        qs = CrewFactionRelationship.objects.filter(crew=obj).select_related(
            "faction"
        )
        show_all = bool(user and getattr(user, "is_staff", False))
        if user and getattr(user, "is_authenticated", False) and obj.campaign_id:
            if obj.campaign.gm_id == user.id:
                show_all = True
        out = []
        for rel in qs:
            fac = rel.faction
            if not show_all and not getattr(fac, "visible_to_players", False):
                continue
            out.append(
                {
                    "id": rel.id,
                    "faction_id": fac.id,
                    "faction_name": fac.name,
                    "reputation_value": rel.reputation_value,
                    "notes": rel.notes or "",
                    "visible_to_players": getattr(fac, "visible_to_players", False),
                }
            )
        return out

    def update(self, instance, validated_data):
        rel_in = self.initial_data.get("faction_relationships")
        instance = super().update(instance, validated_data)
        if rel_in is None:
            return instance
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or not getattr(user, "is_authenticated", False):
            raise serializers.ValidationError(
                {"faction_relationships": "Authentication required."}
            )
        if not (getattr(user, "is_staff", False) or instance.campaign.gm_id == user.id):
            raise serializers.ValidationError(
                {
                    "faction_relationships": (
                        "Only the campaign GM may update faction reputation links."
                    )
                }
            )
        if not isinstance(rel_in, list):
            raise serializers.ValidationError(
                {
                    "faction_relationships": (
                        "Expected a list of objects with faction_id and reputation_value."
                    )
                }
            )
        self._sync_crew_faction_links(instance, rel_in)
        return instance

    @staticmethod
    def _sync_crew_faction_links(crew, rows):
        for row in rows:
            if not isinstance(row, dict):
                continue
            fid = row.get("faction_id") if "faction_id" in row else row.get("faction")
            if fid is None:
                continue
            try:
                fid_int = int(fid)
            except (TypeError, ValueError):
                continue
            if row.get("delete"):
                CrewFactionRelationship.objects.filter(
                    crew=crew, faction_id=fid_int
                ).delete()
                continue
            if not Faction.objects.filter(
                pk=fid_int, campaign_id=crew.campaign_id
            ).exists():
                continue
            try:
                rep = int(row.get("reputation_value", 0))
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    {
                        "faction_relationships": (
                            f"reputation_value for faction_id {fid_int} must be an integer."
                        )
                    }
                )
            rep = max(-3, min(3, rep))
            notes = row.get("notes")
            if notes is None:
                notes = ""
            CrewFactionRelationship.objects.update_or_create(
                crew=crew,
                faction_id=fid_int,
                defaults={
                    "reputation_value": rep,
                    "notes": str(notes)[:500],
                },
            )

    def validate_stash_slots(self, value):
        if value is None:
            return value
        if not isinstance(value, list):
            raise serializers.ValidationError("stash_slots must be a list.")
        if len(value) != 40:
            raise serializers.ValidationError(
                "stash_slots must have exactly 40 boolean elements."
            )
        for i, x in enumerate(value):
            if not isinstance(x, bool):
                raise serializers.ValidationError(
                    f"stash_slots[{i}] must be a boolean."
                )
        return value

class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "username",
            "avatar",
            "avatar_url",
            "signature",
            "display_title",
            "show_avatars",
            "show_signatures",
            "theme",
            "email_digest",
            "email_digest_days",
            "receive_all_email",
            "notification_preferences",
        ]

    def validate_avatar_url(self, value):
        s = (value or "").strip()
        if not s:
            return ""
        if not s.startswith("https://"):
            raise serializers.ValidationError("Use an HTTPS image URL.")
        return s

class InvitableUserSerializer(serializers.ModelSerializer):
    """Lightweight serializer for invitable users list (id, username only)."""

    class Meta:
        model = User
        fields = ["id", "username"]

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer()

    class Meta:
        model = User
        fields = ["id", "username", "profile"]

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", {})
        profile = instance.profile

        instance.username = validated_data.get("username", instance.username)
        instance.save()

        for field in [
            "avatar",
            "avatar_url",
            "signature",
            "display_title",
            "show_avatars",
            "show_signatures",
            "theme",
            "email_digest",
            "email_digest_days",
            "receive_all_email",
            "notification_preferences",
        ]:
            if field in profile_data:
                setattr(profile, field, profile_data[field])
        profile.save()

        return instance

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

class SessionNPCInvolvementWriteSerializer(serializers.Serializer):
    """For PATCH: {npc: id, show_clocks_to_players: bool, show_vulnerability_clock_to_players: bool}"""

    npc = serializers.PrimaryKeyRelatedField(queryset=NPC.objects.all())
    show_clocks_to_players = serializers.BooleanField(default=False)
    show_vulnerability_clock_to_players = serializers.BooleanField(default=False)
    revealed_conflict_clock_names = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    revealed_alt_clock_names = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    revealed_progress_clock_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    show_stand_coin_to_players = serializers.BooleanField(default=False)
    revealed_stand_coin_stats = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    show_all_abilities_to_players = serializers.BooleanField(default=False)
    revealed_ability_names = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )

def _normalize_npc_involvement_clock_flags(show_all, raw_show_vuln_from_client):
    """Persist the same rule as player read-side: full clocks ⇒ vuln visible.

    `raw_show_vuln_from_client` must be the payload flag only (not pre-OR'd with
    show_all); this applies the invariant exactly once: show_all ∨ raw.
    """
    return show_all, show_all or raw_show_vuln_from_client

def _normalized_list(raw, cast=None):
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if cast is int:
            try:
                out.append(int(item))
            except (TypeError, ValueError):
                continue
        else:
            s = str(item).strip()
            if s:
                out.append(s)
    return out

def _ensure_npc_belongs_to_session_campaign(npc, session_campaign_id):
    """Session NPCs must belong to the same campaign as the session."""
    if session_campaign_id is None:
        return
    if npc.campaign_id != session_campaign_id:
        raise serializers.ValidationError(
            "Each NPC in session npc_involvements must belong to this session's campaign."
        )

class SessionSerializer(serializers.ModelSerializer):
    npcs_involved = serializers.SerializerMethodField()
    npc_involvements = serializers.SerializerMethodField()
    characters_involved = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Character.objects.all(), required=False
    )
    proposed_by = UserSerializer(read_only=True)
    votes = UserSerializer(many=True, read_only=True)
    skip_encoded_xp_settlement = serializers.BooleanField(
        write_only=True,
        required=False,
        default=False,
        help_text=(
            "When PATCH sets status to COMPLETED, skip automatic STRUGGLE "
            "playbook XP (still marks encoded pass settled)."
        ),
    )

    class Meta:
        model = Session
        fields = "__all__"

    def validate(self, attrs):
        inst = self.instance
        if inst is None:
            return attrs
        new_status = attrs.get("status", inst.status)
        if inst.status == "COMPLETED" and new_status == "PLANNED":
            aid = (
                Campaign.objects.filter(pk=inst.campaign_id)
                .values_list("active_session_id", flat=True)
                .first()
            )
            if aid == inst.pk:
                raise serializers.ValidationError(
                    {
                        "status": (
                            "Clear this episode as the campaign live session "
                            "before reopening to planned."
                        )
                    }
                )
        return attrs

    def get_npcs_involved(self, obj):
        """Return list of NPC ids for backward compatibility."""
        return list(obj.npcs_involved.values_list("id", flat=True))

    def get_npc_involvements(self, obj):
        """Return involvement rows for GM session controls."""
        return [
            {
                "npc": inv.npc_id,
                "show_clocks_to_players": inv.show_clocks_to_players,
                "show_vulnerability_clock_to_players": inv.show_vulnerability_clock_to_players,
                "revealed_conflict_clock_names": inv.revealed_conflict_clock_names or [],
                "revealed_alt_clock_names": inv.revealed_alt_clock_names or [],
                "revealed_progress_clock_ids": inv.revealed_progress_clock_ids or [],
                "show_stand_coin_to_players": inv.show_stand_coin_to_players,
                "revealed_stand_coin_stats": inv.revealed_stand_coin_stats or [],
                "show_all_abilities_to_players": inv.show_all_abilities_to_players,
                "revealed_ability_names": inv.revealed_ability_names or [],
            }
            for inv in obj.npc_involvements.select_related("npc").order_by("npc__name")
        ]

    def update(self, instance, validated_data):
        npc_involvements_data = self.initial_data.get("npc_involvements")
        npcs_involved_data = self.initial_data.get("npcs_involved")
        validated_data.pop("npcs_involved", None)
        validated_data.pop("npc_involvements", None)
        skip = bool(validated_data.pop("skip_encoded_xp_settlement", False))
        new_status = validated_data.get("status", instance.status)
        if instance.status == "COMPLETED" and new_status == "PLANNED":
            validated_data["auto_encoded_xp_settled"] = False

        loadout_patch = validated_data.get("loadout_by_character")
        if loadout_patch is not None:
            merged = merge_loadout_map(instance.loadout_by_character, loadout_patch)
            if isinstance(loadout_patch, dict):
                for char_key, patch_entry in loadout_patch.items():
                    if not isinstance(patch_entry, dict):
                        continue
                    try:
                        char_id = int(char_key)
                    except (TypeError, ValueError):
                        continue
                    try:
                        character = Character.objects.get(pk=char_id)
                    except Character.DoesNotExist:
                        continue
                    old_entry = normalize_loadout_entry(
                        (instance.loadout_by_character or {}).get(str(char_key))
                    )
                    new_entry = apply_loadout_side_effects(
                        character,
                        old_entry,
                        normalize_loadout_entry(patch_entry),
                    )
                    merged[str(char_key)] = new_entry
            validated_data["loadout_by_character"] = merged

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if npc_involvements_data is not None:
            involvement_rows = []
            for item in npc_involvements_data:
                npc_id = item.get("npc") if isinstance(item, dict) else item
                if isinstance(item, dict):
                    show = bool(item.get("show_clocks_to_players", False))
                    raw_vuln = bool(
                        item.get("show_vulnerability_clock_to_players", False)
                    )
                    show, show_vuln = _normalize_npc_involvement_clock_flags(
                        show, raw_vuln
                    )
                    revealed_conflict = _normalized_list(
                        item.get("revealed_conflict_clock_names")
                    )
                    revealed_alt = _normalized_list(
                        item.get("revealed_alt_clock_names")
                    )
                    revealed_progress_ids = _normalized_list(
                        item.get("revealed_progress_clock_ids"), cast=int
                    )
                    show_stand = bool(item.get("show_stand_coin_to_players", False))
                    revealed_stand = _normalized_list(
                        item.get("revealed_stand_coin_stats")
                    )
                    show_all_abilities = bool(
                        item.get("show_all_abilities_to_players", False)
                    )
                    revealed_abilities = _normalized_list(
                        item.get("revealed_ability_names")
                    )
                else:
                    show = False
                    show_vuln = False
                    revealed_conflict = []
                    revealed_alt = []
                    revealed_progress_ids = []
                    show_stand = False
                    revealed_stand = []
                    show_all_abilities = False
                    revealed_abilities = []
                npc = NPC.objects.get(pk=npc_id) if isinstance(npc_id, int) else npc_id
                _ensure_npc_belongs_to_session_campaign(npc, instance.campaign_id)
                involvement_rows.append(
                    (
                        npc,
                        {
                            "show_clocks_to_players": show,
                            "show_vulnerability_clock_to_players": show_vuln,
                            "revealed_conflict_clock_names": revealed_conflict,
                            "revealed_alt_clock_names": revealed_alt,
                            "revealed_progress_clock_ids": revealed_progress_ids,
                            "show_stand_coin_to_players": show_stand,
                            "revealed_stand_coin_stats": revealed_stand,
                            "show_all_abilities_to_players": show_all_abilities,
                            "revealed_ability_names": revealed_abilities,
                        },
                    )
                )
            instance.npc_involvements.all().delete()
            for npc, defaults in involvement_rows:
                SessionNPCInvolvement.objects.create(
                    session=instance,
                    npc=npc,
                    **defaults,
                )
        elif npcs_involved_data is not None:
            existing = {inv.npc_id: inv for inv in instance.npc_involvements.all()}
            new_ids = set(npcs_involved_data)
            for npc_id in new_ids:
                if npc_id in existing:
                    continue
                npc = NPC.objects.get(pk=npc_id)
                _ensure_npc_belongs_to_session_campaign(npc, instance.campaign_id)
            for npc_id in new_ids:
                if npc_id in existing:
                    continue
                SessionNPCInvolvement.objects.get_or_create(
                    session=instance,
                    npc_id=npc_id,
                    defaults={
                        "show_clocks_to_players": False,
                        "show_vulnerability_clock_to_players": False,
                        "revealed_conflict_clock_names": [],
                        "revealed_alt_clock_names": [],
                        "revealed_progress_clock_ids": [],
                        "show_stand_coin_to_players": False,
                        "revealed_stand_coin_stats": [],
                        "show_all_abilities_to_players": False,
                        "revealed_ability_names": [],
                    },
                )
            for npc_id in list(existing.keys()):
                if npc_id not in new_ids:
                    instance.npc_involvements.filter(npc_id=npc_id).delete()

        setattr(instance, "_skip_encoded_xp_settlement", skip)
        return instance

    def create(self, validated_data):
        npc_involvements_data = self.initial_data.get("npc_involvements")
        npcs_involved_data = self.initial_data.get("npcs_involved")
        validated_data.pop("npcs_involved", None)
        validated_data.pop("npc_involvements", None)
        validated_data.pop("skip_encoded_xp_settlement", None)
        instance = super().create(validated_data)
        if npc_involvements_data is not None:
            involvement_rows = []
            for item in npc_involvements_data:
                npc_id = item.get("npc") if isinstance(item, dict) else item
                if isinstance(item, dict):
                    show = bool(item.get("show_clocks_to_players", False))
                    raw_vuln = bool(
                        item.get("show_vulnerability_clock_to_players", False)
                    )
                    show, show_vuln = _normalize_npc_involvement_clock_flags(
                        show, raw_vuln
                    )
                    revealed_conflict = _normalized_list(
                        item.get("revealed_conflict_clock_names")
                    )
                    revealed_alt = _normalized_list(
                        item.get("revealed_alt_clock_names")
                    )
                    revealed_progress_ids = _normalized_list(
                        item.get("revealed_progress_clock_ids"), cast=int
                    )
                    show_stand = bool(item.get("show_stand_coin_to_players", False))
                    revealed_stand = _normalized_list(
                        item.get("revealed_stand_coin_stats")
                    )
                    show_all_abilities = bool(
                        item.get("show_all_abilities_to_players", False)
                    )
                    revealed_abilities = _normalized_list(
                        item.get("revealed_ability_names")
                    )
                else:
                    show = False
                    show_vuln = False
                    revealed_conflict = []
                    revealed_alt = []
                    revealed_progress_ids = []
                    show_stand = False
                    revealed_stand = []
                    show_all_abilities = False
                    revealed_abilities = []
                npc = NPC.objects.get(pk=npc_id) if isinstance(npc_id, int) else npc_id
                _ensure_npc_belongs_to_session_campaign(npc, instance.campaign_id)
                involvement_rows.append(
                    (
                        npc,
                        {
                            "show_clocks_to_players": show,
                            "show_vulnerability_clock_to_players": show_vuln,
                            "revealed_conflict_clock_names": revealed_conflict,
                            "revealed_alt_clock_names": revealed_alt,
                            "revealed_progress_clock_ids": revealed_progress_ids,
                            "show_stand_coin_to_players": show_stand,
                            "revealed_stand_coin_stats": revealed_stand,
                            "show_all_abilities_to_players": show_all_abilities,
                            "revealed_ability_names": revealed_abilities,
                        },
                    )
                )
            for npc, defaults in involvement_rows:
                SessionNPCInvolvement.objects.create(
                    session=instance,
                    npc=npc,
                    **defaults,
                )
        elif npcs_involved_data is not None:
            for npc_id in npcs_involved_data:
                npc = NPC.objects.get(pk=npc_id)
                _ensure_npc_belongs_to_session_campaign(npc, instance.campaign_id)
            for npc_id in npcs_involved_data:
                SessionNPCInvolvement.objects.get_or_create(
                    session=instance,
                    npc_id=npc_id,
                    defaults={
                        "show_clocks_to_players": False,
                        "show_vulnerability_clock_to_players": False,
                        "revealed_conflict_clock_names": [],
                        "revealed_alt_clock_names": [],
                        "revealed_progress_clock_ids": [],
                        "show_stand_coin_to_players": False,
                        "revealed_stand_coin_stats": [],
                        "show_all_abilities_to_players": False,
                        "revealed_ability_names": [],
                    },
                )
        return instance

class XPHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = XPHistory
        fields = "__all__"

class StressHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = StressHistory
        fields = "__all__"

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = "__all__"

class SessionEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionEvent
        fields = "__all__"
        read_only_fields = ["timestamp"]

class ExperienceTrackerSerializer(serializers.ModelSerializer):
    character = serializers.PrimaryKeyRelatedField(queryset=Character.objects.all())
    session = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)
    session_name = serializers.CharField(
        source="session.name", read_only=True, default=None
    )
    trigger_display = serializers.CharField(
        source="get_trigger_display", read_only=True
    )
    award_source_display = serializers.CharField(
        source="get_award_source_display", read_only=True
    )
    awarded_by = serializers.PrimaryKeyRelatedField(
        read_only=True, allow_null=True
    )
    awarded_by_username = serializers.CharField(
        source="awarded_by.username", read_only=True, default=None
    )
    can_undo_from_sheet = serializers.SerializerMethodField()
    undo_block_reason = serializers.SerializerMethodField()

    class Meta:
        model = ExperienceTracker
        fields = [
            "id",
            "character",
            "session",
            "session_name",
            "session_date",
            "trigger",
            "trigger_display",
            "description",
            "xp_gained",
            "award_source",
            "award_source_display",
            "awarded_by",
            "awarded_by_username",
            "clock_key",
            "can_undo_from_sheet",
            "undo_block_reason",
        ]
        read_only_fields = [
            "session_date",
            "session",
            "session_name",
            "trigger_display",
            "award_source",
            "award_source_display",
            "awarded_by",
            "awarded_by_username",
            "clock_key",
            "can_undo_from_sheet",
            "undo_block_reason",
        ]

    def get_can_undo_from_sheet(self, obj):
        from .services.character_history_undo import experience_tracker_undoable_from_sheet

        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        allowed, _reason = experience_tracker_undoable_from_sheet(obj, request.user)
        return allowed

    def get_undo_block_reason(self, obj):
        from .services.character_history_undo import experience_tracker_undoable_from_sheet

        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        allowed, reason = experience_tracker_undoable_from_sheet(obj, request.user)
        return None if allowed else reason

class GroupActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupAction
        fields = [
            "id",
            "session",
            "leader",
            "action_name",
            "goal_label",
            "status",
            "created_at",
        ]
        read_only_fields = ["status", "created_at"]

class RollSerializer(serializers.ModelSerializer):
    character_name = serializers.CharField(source="character.true_name", read_only=True)
    rolled_by_username = serializers.CharField(
        source="rolled_by.username", read_only=True
    )
    recovery_target_character_name = serializers.SerializerMethodField()
    xp_awarded = serializers.SerializerMethodField()
    xp_award_detail = serializers.SerializerMethodField()
    xp_award_details = serializers.SerializerMethodField()

    class Meta:
        model = Roll
        fields = [
            "id",
            "character",
            "character_name",
            "session",
            "roll_type",
            "action_name",
            "position",
            "effect",
            "dice_pool",
            "results",
            "outcome",
            "description",
            "goal_label",
            "group_action",
            "rolled_by",
            "rolled_by_username",
            "timestamp",
            "xp_awarded",
            "xp_award_detail",
            "xp_award_details",
            "pool_action_rating",
            "pool_attribute_dice",
            "push_for_effect",
            "push_for_dice",
            "uses_devil_bargain",
            "pool_assist_dice",
            "pool_bonus_dice",
            "roller_stress_spent",
            "modifier_sources",
            "stress_sources",
            "position_effect_sources",
            "devil_bargain_consequence",
            "fortune_reveal_outcome",
            "fortune_public_label",
            "recovery_context",
            "recovery_target",
            "recovery_target_character_name",
        ]
        read_only_fields = ["timestamp", "rolled_by"]

    def get_recovery_target_character_name(self, obj):
        t = getattr(obj, "recovery_target", None)
        if t is None:
            return ""
        return getattr(t, "true_name", None) or getattr(t, "alias", "") or ""

    def validate_effect(self, value):
        from .roll_helpers import normalize_effect

        return normalize_effect(value)

    def get_xp_awarded(self, obj):
        from .models import ExperienceTracker

        return ExperienceTracker.objects.filter(roll=obj).exists()

    def _xp_display_track_for_trigger(self, roll, trigger: str):
        from .roll_helpers import xp_track_for_action_name

        t = (trigger or "").upper()
        if t in ("DESPERATE_ROLL", "DESPERATE"):
            return xp_track_for_action_name(roll.action_name or "")
        if t == "BELIEFS":
            return "heritage"
        if t in ("STRUGGLE", "PLAYBOOK_SPECIFIC"):
            return "playbook"
        return None

    def _build_xp_award_details(self, obj):
        """All ExperienceTracker rows for this roll (ordered by pk); used by session UI."""
        from .models import ExperienceTracker

        ets = list(
            ExperienceTracker.objects.filter(roll=obj)
            .select_related("character")
            .order_by("pk")
        )
        if not ets:
            return []
        char_ids = {et.character_id for et in ets}
        shared_clocks = {}
        shared_all_total = 0
        if len(char_ids) == 1:
            char = ets[0].character
            try:
                char.refresh_from_db(fields=["xp_clocks"])
            except Exception:
                pass
            shared_clocks = dict(char.xp_clocks or {})
            shared_all_total = sum(int(v or 0) for v in shared_clocks.values())

        out = []
        for et in ets:
            if len(char_ids) == 1:
                clocks = shared_clocks
                all_tracks_total = shared_all_total
            else:
                c = et.character
                try:
                    c.refresh_from_db(fields=["xp_clocks"])
                except Exception:
                    pass
                clocks = dict(c.xp_clocks or {})
                all_tracks_total = sum(int(v or 0) for v in clocks.values())
            track = self._xp_display_track_for_trigger(obj, et.trigger)
            track_total = None
            if track:
                track_total = int(clocks.get(track, 0) or 0)
            out.append(
                {
                    "xp_gained": int(et.xp_gained or 0),
                    "trigger": et.trigger,
                    "trigger_label": et.get_trigger_display(),
                    "track": track,
                    "track_total": track_total,
                    "all_tracks_total": all_tracks_total,
                    "description": (et.description or "")[:500],
                }
            )
        return out

    def get_xp_award_details(self, obj):
        return self._build_xp_award_details(obj)

    def get_xp_award_detail(self, obj):
        """First XP row for this roll (by pk); prefer ``xp_award_details`` for full list."""
        details = self._build_xp_award_details(obj)
        return details[0] if details else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        is_gm = bool(
            user
            and getattr(user, "is_authenticated", False)
            and (
                getattr(user, "is_staff", False)
                or instance.session.campaign.gm_id == user.id
            )
        )
        if (
            (instance.roll_type or "").upper() == "FORTUNE"
            and not is_gm
            and not instance.fortune_reveal_outcome
        ):
            data["results"] = []
            data["outcome"] = ""
            data["dice_pool"] = 0
            data["position"] = ""
            data["effect"] = ""
            data["pool_action_rating"] = 0
            data["pool_attribute_dice"] = 0
            data["push_for_effect"] = False
            data["push_for_dice"] = False
            data["uses_devil_bargain"] = False
            data["pool_assist_dice"] = 0
            data["pool_bonus_dice"] = 0
            data["roller_stress_spent"] = 0
            data["modifier_sources"] = []
            data["stress_sources"] = []
            data["position_effect_sources"] = []
            data["devil_bargain_consequence"] = ""
            public_label = (instance.fortune_public_label or "").strip()
            data["action_name"] = public_label or "Fortune"
            data["goal_label"] = public_label or ""
            data["description"] = public_label or "GM fortune roll"
        return data

class SessionRecordsSerializer(serializers.ModelSerializer):
    """Extended session serializer with events, xp_history, stress_history, rolls for session records view."""

    npcs_involved = serializers.SerializerMethodField()
    npc_involvements = serializers.SerializerMethodField()
    characters_involved = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Character.objects.all(), required=False
    )
    proposed_by = UserSerializer(read_only=True)
    votes = UserSerializer(many=True, read_only=True)
    events = SessionEventSerializer(many=True, read_only=True)
    xp_history = XPHistorySerializer(
        source="session_xp_history", many=True, read_only=True
    )
    stress_history = StressHistorySerializer(
        source="session_stress_history", many=True, read_only=True
    )
    xp_entries = ExperienceTrackerSerializer(many=True, read_only=True)
    rolls = RollSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = [
            "id",
            "campaign",
            "name",
            "session_date",
            "proposed_date",
            "description",
            "objective",
            "planned_for_next_session",
            "status",
            "npcs_involved",
            "npc_involvements",
            "characters_involved",
            "proposed_score_target",
            "proposed_score_description",
            "proposed_by",
            "votes",
            "events",
            "xp_history",
            "stress_history",
            "xp_entries",
            "rolls",
            "roll_goal_label",
            "roll_goal_by_character",
            "show_position_effect_to_players",
            "default_position",
            "default_effect",
            "position_effect_by_character",
            "loadout_by_character",
            "devils_bargain_by_character",
            "ripple_breathing_free_push_claimed_by_character",
        ]

    def get_npcs_involved(self, obj):
        return list(obj.npcs_involved.values_list("id", flat=True))

    def get_npc_involvements(self, obj):
        return [
            {
                "npc": inv.npc_id,
                "show_clocks_to_players": inv.show_clocks_to_players,
                "show_vulnerability_clock_to_players": inv.show_vulnerability_clock_to_players,
            }
            for inv in obj.npc_involvements.select_related("npc").order_by("npc__name")
        ]

class CharacterHistorySerializer(serializers.ModelSerializer):
    character_true_name = serializers.CharField(
        source="character.true_name", read_only=True
    )
    editor_username = serializers.SerializerMethodField()
    can_undo = serializers.SerializerMethodField()
    undo_block_reason = serializers.SerializerMethodField()

    class Meta:
        model = CharacterHistory
        fields = [
            "id",
            "character",
            "character_true_name",
            "editor",
            "editor_username",
            "timestamp",
            "changed_fields",
            "reverted_at",
            "can_undo",
            "undo_block_reason",
        ]

    def get_editor_username(self, obj):
        return obj.editor.username if obj.editor_id else None

    def get_can_undo(self, obj):
        from .services.character_history_undo import can_undo_character_history

        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        allowed, _reason = can_undo_character_history(obj, request.user)
        return allowed

    def get_undo_block_reason(self, obj):
        from .services.character_history_undo import can_undo_character_history

        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        allowed, reason = can_undo_character_history(obj, request.user)
        return None if allowed else reason

class CrewHistorySerializer(serializers.ModelSerializer):
    crew_name = serializers.CharField(source="crew.name", read_only=True)
    editor_username = serializers.SerializerMethodField()

    class Meta:
        model = CrewHistory
        fields = [
            "id",
            "crew",
            "crew_name",
            "editor",
            "editor_username",
            "timestamp",
            "changed_fields",
        ]

    def get_editor_username(self, obj):
        return obj.editor.username if obj.editor_id else None

class CampaignAuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.SerializerMethodField()

    class Meta:
        model = CampaignAuditLog
        fields = [
            "id",
            "campaign",
            "actor",
            "actor_username",
            "timestamp",
            "action",
            "payload",
        ]

    def get_actor_username(self, obj):
        return obj.actor.username if obj.actor_id else None

class BenefitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Benefit
        fields = ["id", "name", "hp_cost", "required", "description"]

class DetrimentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Detriment
        fields = ["id", "name", "hp_value", "required", "description"]

class HeritageSerializer(serializers.ModelSerializer):
    benefits = BenefitSerializer(many=True, read_only=True)
    detriments = DetrimentSerializer(many=True, read_only=True)

    class Meta:
        model = Heritage
        fields = ["id", "name", "base_hp", "description", "benefits", "detriments"]

class FlexibleHeritagePrimaryKeyField(serializers.PrimaryKeyRelatedField):
    """Accepts heritage id (int or numeric string) or heritage display name (e.g. Human)."""

    def to_internal_value(self, data):
        if data is None:
            if self.required:
                self.fail("required")
            return None
        queryset = self.get_queryset()
        if isinstance(data, Heritage):
            if not queryset.filter(pk=data.pk).exists():
                self.fail("does_not_exist", pk_name=data.pk)
            return data
        if isinstance(data, int):
            return queryset.get(pk=data)
        if isinstance(data, str):
            s = data.strip()
            if not s:
                if self.allow_null:
                    return None
                self.fail("invalid")
            if s.isdigit():
                return queryset.get(pk=int(s))
            match = queryset.filter(name__iexact=s).first()
            if match is not None:
                return match
            self.fail("does_not_exist", pk_name=s)
        return super().to_internal_value(data)

class ViceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vice
        fields = "__all__"

class AbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Ability
        fields = ["id", "name", "description", "type", "category"]

class StandAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = StandAbility
        fields = ["id", "stand", "name", "description"]

class HamonAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = HamonAbility
        fields = [
            "id",
            "name",
            "hamon_type",
            "description",
            "required_a_count",
            "stress_cost",
            "frequency",
        ]

class SpinAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SpinAbility
        fields = [
            "id",
            "name",
            "spin_type",
            "description",
            "required_a_count",
            "stress_cost",
            "frequency",
        ]

class StandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stand
        fields = "__all__"

_STAND_TYPE_KEYS = frozenset(k for k, _ in Stand.TYPE_CHOICES)
_STAND_FORM_PRESETS = frozenset(k for k, _ in Stand.FORM_CHOICES)
_STAND_CONSCIOUSNESS = frozenset("ABCDEF")
_STAND_GRADE_FIELDS = (
    "power",
    "speed",
    "range",
    "durability",
    "precision",
    "development",
)
_STAND_GRADES = frozenset("SABCDF")


def _stand_type_from_payload(stand_data, default="FIGHTING"):
    """Accept nested stand.type when it matches TYPE_CHOICES; else default."""
    if not isinstance(stand_data, dict):
        return default
    raw = str(stand_data.get("type") or "").strip().upper()
    return raw if raw in _STAND_TYPE_KEYS else default


def _normalize_grade(val):
    if val is None:
        return None
    g = str(val).upper()[:1]
    return g if g in _STAND_GRADES else None


def _grades_from_payload(stand_data=None, coin_stats=None):
    """Collect grade keys present in stand and/or coin_stats. Never invent D for missing keys."""
    out = {}
    for src in (stand_data, coin_stats):
        if not isinstance(src, dict):
            continue
        for field in _STAND_GRADE_FIELDS:
            if field not in src and field.upper() not in src:
                continue
            raw = src.get(field)
            if raw is None:
                raw = src.get(field.upper())
            g = _normalize_grade(raw)
            if g is not None:
                out[field] = g
    return out


def _coin_stats_mirror_from_stand(stand) -> dict:
    return {f: getattr(stand, f) for f in _STAND_GRADE_FIELDS}


def _apply_stand_grades(stand, grades: dict) -> None:
    for field, grade in grades.items():
        if field in _STAND_GRADE_FIELDS:
            setattr(stand, field, grade)


def _stand_row_defaults_for_create(character, grades: dict, *, stand_type: str) -> dict:
    """Defaults for a new Stand row — full D baseline only when creating, not on PATCH."""
    base = {field: "D" for field in _STAND_GRADE_FIELDS}
    base.update({k: v for k, v in grades.items() if k in _STAND_GRADE_FIELDS})
    base.update(
        {
            "name": character.stand_name or "Unnamed Stand",
            "type": stand_type or "FIGHTING",
            "type_custom": "",
            "form": "Humanoid",
            "forms": ["Humanoid"],
            "consciousness_level": "C",
            "armor": 0,
        }
    )
    return base


def _a_rank_count_from_stand_or_payload(instance, data) -> int:
    """Prefer live Stand grades; fall back to payload grades present only."""
    if instance is not None:
        try:
            stand = instance.stand
            return sum(
                1
                for f in _STAND_GRADE_FIELDS
                if str(getattr(stand, f, "") or "").upper()[:1] == "A"
            )
        except Stand.DoesNotExist:
            pass
        except Exception:
            pass
    grades = _grades_from_payload(
        data.get("stand") if isinstance(data.get("stand"), dict) else None,
        data.get("coin_stats"),
    )
    return sum(1 for g in grades.values() if g == "A")


def _normalize_stand_forms(raw) -> list[str]:
    """Dedupe preserving order; allow FORM_CHOICES presets and custom strings."""
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for x in raw:
        s = str(x or "").strip()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s[:100])
    return out


def _legacy_form_from_forms(forms: list[str]) -> str:
    for f in forms:
        if f in _STAND_FORM_PRESETS:
            return f
    return "Humanoid"


def _apply_stand_identity_fields(stand, stand_data: dict) -> None:
    """Apply flavor identity fields from nested stand payload onto a Stand row."""
    if not isinstance(stand_data, dict):
        return
    if "forms" in stand_data:
        forms = _normalize_stand_forms(stand_data.get("forms"))
        stand.forms = forms
        stand.form = _legacy_form_from_forms(forms)
    elif stand_data.get("form"):
        form = str(stand_data.get("form") or "").strip()
        if form:
            stand.form = form if form in _STAND_FORM_PRESETS else stand.form
            forms = list(stand.forms or [])
            if form not in forms:
                forms = [form] + [x for x in forms if x != form]
            stand.forms = forms
    if "consciousness_level" in stand_data:
        c = str(stand_data.get("consciousness_level") or "").strip().upper()[:1]
        if c in _STAND_CONSCIOUSNESS:
            stand.consciousness_level = c
    if "type_custom" in stand_data:
        stand.type_custom = str(stand_data.get("type_custom") or "").strip()[:100]

class CharacterSerializer(serializers.ModelSerializer):
    image = serializers.FileField(required=False)
    heritage = FlexibleHeritagePrimaryKeyField(
        queryset=Heritage.objects.all(), allow_null=True, required=False
    )
    # display current campaign's wanted stars
    wanted_stars = serializers.IntegerField(
        source="campaign.wanted_stars", read_only=True
    )
    stand = StandSerializer(read_only=True)
    crew = CrewSerializer(read_only=True)
    crew_id = serializers.PrimaryKeyRelatedField(
        source="crew",
        queryset=Crew.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    creator_username = serializers.CharField(source="user.username", read_only=True)
    heritage_details = HeritageSerializer(source="heritage", read_only=True)
    # nested vice info
    vice_info = ViceSerializer(source="vice", read_only=True)
    # standard chosen abilities
    standard_abilities = serializers.PrimaryKeyRelatedField(
        queryset=Ability.objects.all(), many=True, required=False
    )
    standard_ability_details = serializers.SerializerMethodField()
    # custom ability fields and extra custom abilities JSON
    extra_custom_abilities = serializers.JSONField(required=False)
    # hamon and spin ability inputs
    hamon_ability_ids = serializers.PrimaryKeyRelatedField(
        queryset=HamonAbility.objects.all(), many=True, write_only=True, required=False
    )
    spin_ability_ids = serializers.PrimaryKeyRelatedField(
        queryset=SpinAbility.objects.all(), many=True, write_only=True, required=False
    )
    # nested ability details for playbook abilities
    hamon_ability_details = serializers.SerializerMethodField()
    spin_ability_details = serializers.SerializerMethodField()

    selected_benefits = serializers.PrimaryKeyRelatedField(
        queryset=Benefit.objects.all(), many=True, required=False
    )
    selected_detriments = serializers.PrimaryKeyRelatedField(
        queryset=Detriment.objects.all(), many=True, required=False
    )

    custom_vice = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )
    # trauma list details from JSONField
    trauma_details = serializers.SerializerMethodField()

    # Faction reputation and GM settings
    faction_reputation = serializers.JSONField(required=False)
    gm_character_locked = serializers.BooleanField(required=False)
    gm_allowed_edit_fields = serializers.JSONField(required=False)
    inventory = serializers.JSONField(required=False)
    reputation_status = serializers.JSONField(required=False)

    class Meta:
        model = Character
        fields = "__all__"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        rejected = getattr(self, "_rejected_sheet_fields", None)
        if rejected:
            data["rejected_fields"] = rejected
        clocks = list(instance.progress_clocks.all().order_by("id"))
        data["progress_clocks"] = [
            {
                "id": c.id,
                "name": c.name,
                "clock_type": c.clock_type,
                "max_segments": c.max_segments,
                "filled_segments": c.filled_segments,
                "segments": c.max_segments,
                "filled": c.filled_segments,
                "description": c.description or "",
                "visible_to_party": c.visible_to_party,
                "visible_to_players": c.visible_to_players,
                "session": c.session_id,
                "campaign": c.campaign_id,
                "completed": c.completed,
                "created_by": c.created_by_id,
            }
            for c in clocks
        ]
        from .services.xp_allocation import (
            get_pending_stand_a_reward,
            second_playbook_unlocked,
        )
        from .models import PendingAdvance

        data["pending_stand_a_reward"] = get_pending_stand_a_reward(instance)
        data["secondary_playbook_unlocked"] = second_playbook_unlocked(instance)
        open_pendings = PendingAdvance.objects.filter(
            character=instance, status=PendingAdvance.STATUS_OPEN
        ).order_by("created_at", "id")
        data["pending_advances"] = [
            {
                "id": p.id,
                "track": p.track,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in open_pendings
        ]
        by_track = {}
        for p in open_pendings:
            by_track[p.track] = by_track.get(p.track, 0) + 1
        data["pending_advance_counts"] = by_track
        from .services.plan_queue import list_queued_plan_items, serialize_plan_item

        data["advancement_plan"] = [
            serialize_plan_item(item) for item in list_queued_plan_items(instance)
        ]
        return data

    def validate_coin_boxes(self, value):
        if value is None:
            return value
        if not isinstance(value, list):
            raise serializers.ValidationError("coin_boxes must be a list.")
        if len(value) != 4:
            raise serializers.ValidationError(
                "coin_boxes must have exactly 4 boolean elements."
            )
        for i, x in enumerate(value):
            if not isinstance(x, bool):
                raise serializers.ValidationError(f"coin_boxes[{i}] must be a boolean.")
        return value

    def validate_stash_slots(self, value):
        if value is None:
            return value
        if not isinstance(value, list):
            raise serializers.ValidationError("stash_slots must be a list.")
        if len(value) != 40:
            raise serializers.ValidationError(
                "stash_slots must have exactly 40 boolean elements."
            )
        for i, x in enumerate(value):
            if not isinstance(x, bool):
                raise serializers.ValidationError(
                    f"stash_slots[{i}] must be a boolean."
                )
        return value

    def validate(self, data):
        # Validate stress/trauma system
        if "stress" in data:
            stress = data.get("stress")
            if stress is None:
                stress = 0
        else:
            stress = getattr(self.instance, "stress", 0) if self.instance else 0

        if "trauma" in data:
            trauma_list = data.get("trauma")
            if trauma_list is None:
                trauma_list = []
        else:
            trauma_list = (
                list(getattr(self.instance, "trauma", []) or [])
                if self.instance
                else []
            )

        # Check if character should take trauma at 11+ stress
        if stress >= 11:
            trauma_count = len(trauma_list)
            if trauma_count >= 4:
                raise serializers.ValidationError(
                    "Character is dead (4+ trauma). Cannot continue playing."
                )
            # Note: We don't auto-add trauma here, that's handled by the frontend

        # Partial PATCH: omitted ability id lists must fall back to instance M2M,
        # else playbook-gated checks skip or false-reject when only abilities are sent.
        if "hamon_ability_ids" in data:
            hamon_ids = data.get("hamon_ability_ids") or []
        elif self.instance is not None:
            hamon_ids = [
                link.hamon_ability for link in self.instance.hamon_abilities.all()
            ]
        else:
            hamon_ids = []
        if "spin_ability_ids" in data:
            spin_ids = data.get("spin_ability_ids") or []
        elif self.instance is not None:
            spin_ids = [
                link.spin_ability for link in self.instance.spin_abilities.all()
            ]
        else:
            spin_ids = []
        playbook_val = data.get("playbook")
        if playbook_val is None and self.instance:
            playbook_val = self.instance.playbook
        if playbook_val is None:
            playbook_val = "STAND"

        secondary_playbook_val = data.get("secondary_playbook")
        if secondary_playbook_val is None and self.instance:
            secondary_playbook_val = self.instance.secondary_playbook
        if secondary_playbook_val == "":
            secondary_playbook_val = None
        # Plan A: secondary_playbook is legacy-only. Reject new writes; keep
        # grandfathered values when the client echoes the same field.
        if "secondary_playbook" in data:
            incoming = data.get("secondary_playbook") or None
            if incoming == "":
                incoming = None
            prior = (
                getattr(self.instance, "secondary_playbook", None)
                if self.instance
                else None
            )
            if incoming and incoming != prior:
                raise serializers.ValidationError(
                    {
                        "secondary_playbook": (
                            "Second playbook unlock is removed. Cross-playbook "
                            "abilities cost one playbook fill each."
                        )
                    }
                )

        # Character level no longer gates Spin/Hamon picks (depth = owned
        # non-foundation count; slot budget below). Cross-playbook fills OK.
        has_hamon = (
            playbook_val == "HAMON"
            or secondary_playbook_val == "HAMON"
            or bool(hamon_ids)
        )
        has_spin = (
            playbook_val == "SPIN"
            or secondary_playbook_val == "SPIN"
            or bool(spin_ids)
        )
        _ = (has_hamon, has_spin)

        from .services.xp_allocation import (
            non_foundation_playbook_ability_count,
            playbook_ability_slot_budget,
        )

        if has_hamon or has_spin:
            new_nf = non_foundation_playbook_ability_count(hamon_ids, spin_ids)
            if self.instance is not None:
                old_hamon = [
                    link.hamon_ability for link in self.instance.hamon_abilities.all()
                ]
                old_spin = [
                    link.spin_ability for link in self.instance.spin_abilities.all()
                ]
                old_nf = non_foundation_playbook_ability_count(old_hamon, old_spin)
            else:
                old_nf = 0
            if new_nf > old_nf:
                budget = playbook_ability_slot_budget(self.instance)
                if new_nf > budget:
                    raise serializers.ValidationError(
                        f"Playbook ability limit reached ({new_nf} selected, "
                        f"{budget} allowed). Take a playbook advance (+1 playbook "
                        "ability) before adding another."
                    )

        heritage = data.get("heritage") or getattr(self.instance, "heritage", None)
        # Partial PATCH: merge M2M from instance when keys omitted.
        if "selected_benefits" in data:
            benefits = data["selected_benefits"]
        elif self.instance:
            benefits = list(self.instance.selected_benefits.all())
        else:
            benefits = []

        if "selected_detriments" in data:
            detriments = data["selected_detriments"]
        elif self.instance:
            detriments = list(self.instance.selected_detriments.all())
        else:
            detriments = []

        if "bonus_hp_from_xp" in data:
            bonus_hp = data["bonus_hp_from_xp"]
            if bonus_hp is None:
                bonus_hp = 0
        elif self.instance:
            bonus_hp = self.instance.bonus_hp_from_xp or 0
        else:
            bonus_hp = 0

        if not heritage:
            raise serializers.ValidationError("You must pick a Heritage.")

        base_hp = heritage.base_hp + bonus_hp
        gain = sum(d.hp_value for d in detriments if not d.required)
        cost = sum(b.hp_cost for b in benefits if not b.required)

        if base_hp + gain < cost:
            raise serializers.ValidationError(
                f"HP budget exceeded (base {base_hp} + optional detriments {gain} "
                f"< optional benefits {cost})."
            )

        # Ensure required benefits/detriments are selected
        req_bens = set(heritage.benefits.filter(required=True))
        if not req_bens.issubset(set(benefits)):
            missing = req_bens - set(benefits)
            raise serializers.ValidationError(
                f"Missing required benefits: {[b.name for b in missing]}"
            )

        req_dets = set(heritage.detriments.filter(required=True))
        if not req_dets.issubset(set(detriments)):
            missing = req_dets - set(detriments)
            raise serializers.ValidationError(
                f"Missing required detriments: {[d.name for d in missing]}"
            )
        # Validate action dice advancement: extra dots beyond 7 must be covered by XP
        action_dots = data.get("action_dots") or getattr(
            self.instance, "action_dots", {}
        )

        # Support both flat {hunt: 1, study: 0, ...} and nested {insight: {hunt: 1, ...}, ...} formats
        def _total_action_dots(ad):
            if not ad:
                return 0
            first = next(iter(ad.values()), None)
            if isinstance(first, dict):
                return sum(v for group in ad.values() for v in group.values())
            return sum(v for v in ad.values() if isinstance(v, (int, float)))

        total_dots = _total_action_dots(action_dots)
        if total_dots > 7:
            extra_dice = total_dots - 7
            # each extra die costs 5 XP
            # Temporarily bypass XP validation for character creation
            # xp_gained = sum(entry.xp_gained for entry in self.instance.experience_entries.all()) if self.instance else 0
            # max_dice_from_xp = xp_gained // 5
            # if extra_dice > max_dice_from_xp:
            #     required_xp = extra_dice * 5
            #     raise serializers.ValidationError(
            #         f"Not enough XP: {extra_dice} extra dice require {required_xp} XP (5 XP each), but only {xp_gained} XP available."
            #     )
            pass  # Temporarily bypass XP validation for character creation
        # Client xp_clocks are rejected by sheet_patch_guard on existing rows.
        # Skip validating stale autosave echoes (often playbook:10 pre–fill-clear).
        from .services.sheet_patch_guard import sheet_patch_guard_enabled

        skip_client_clocks = bool(
            self.instance is not None and sheet_patch_guard_enabled(self)
        )
        if not skip_client_clocks:
            xp_clocks = data.get("xp_clocks") or getattr(
                self.instance, "xp_clocks", {}
            )
            playbook_xp = int((xp_clocks or {}).get("playbook", 0) or 0)
            # Fill-clear keeps marks below cap; reject absurd overflow on create.
            if playbook_xp > 10:
                raise serializers.ValidationError(
                    f"Playbook track XP cannot exceed 10; received {playbook_xp}."
                )

        # GM character locking validation
        if self.instance and self.instance.campaign:
            gm_locked = data.get("gm_character_locked") or getattr(
                self.instance, "gm_character_locked", False
            )
            allowed_fields = data.get("gm_allowed_edit_fields") or getattr(
                self.instance, "gm_allowed_edit_fields", {}
            )

            # Only GM can modify locking settings
            request = self.context.get("request")
            if request and hasattr(request, "user"):
                is_gm = self.instance.campaign.gm == request.user

                if gm_locked and not is_gm:
                    # Check if any locked fields are being modified
                    restricted_fields = [
                        "heritage",
                        "selected_benefits",
                        "selected_detriments",
                        "playbook",
                        "secondary_playbook",
                    ]
                    for field in restricted_fields:
                        if field in data and not allowed_fields.get(field, True):
                            raise serializers.ValidationError(
                                f"Field '{field}' is locked by GM and cannot be modified."
                            )

        # Crew assignment (client sends crew_id; internal key is crew)
        request = self.context.get("request")
        if "crew" in data:
            if (
                not request
                or not getattr(request, "user", None)
                or not request.user.is_authenticated
            ):
                raise serializers.ValidationError(
                    {"crew_id": "Authentication required."}
                )
            new_crew = data["crew"]
            campaign = data.get("campaign")
            if self.instance is not None:
                if campaign is None:
                    campaign = self.instance.campaign
                elif not hasattr(campaign, "id"):
                    try:
                        campaign = (
                            Campaign.objects.get(pk=campaign)
                            if campaign is not None
                            else None
                        )
                    except Campaign.DoesNotExist:
                        campaign = None
            elif campaign is not None and not hasattr(campaign, "id"):
                try:
                    campaign = Campaign.objects.get(pk=campaign)
                except Campaign.DoesNotExist:
                    campaign = None

            if new_crew is not None:
                if campaign is None:
                    raise serializers.ValidationError(
                        {
                            "crew_id": "Assign the character to a campaign before joining a crew."
                        }
                    )
                c_id = campaign.id if hasattr(campaign, "id") else campaign
                if new_crew.campaign_id != c_id:
                    raise serializers.ValidationError(
                        {
                            "crew_id": "Crew must belong to the same campaign as the character."
                        }
                    )

            if self.instance is not None:
                u = request.user
                is_owner = self.instance.user_id == u.id
                is_gm = (
                    self.instance.campaign_id is not None
                    and self.instance.campaign.gm_id == u.id
                )
                if not (u.is_staff or is_owner or is_gm):
                    raise serializers.ValidationError(
                        {"crew_id": "You cannot change this character's crew."}
                    )

        if "playbook_xp_archetypes" in data:
            data["playbook_xp_archetypes"] = normalize_playbook_xp_archetypes(
                playbook_val, data.get("playbook_xp_archetypes")
            )

        if "inventory" in data:
            data["inventory"] = normalize_inventory_list(data.get("inventory"))

        return data

    def create(self, validated_data):
        custom_vice = validated_data.pop("custom_vice", None)
        vice_details = validated_data.pop("vice_details", None)
        stand_data = self.initial_data.get("stand")
        # coin_stats is derived from Stand — do not treat client JSON as write authority
        validated_data.pop("coin_stats", None)
        hamon_ids = validated_data.pop("hamon_ability_ids", [])
        spin_ids = validated_data.pop("spin_ability_ids", [])
        std_ids = validated_data.pop("standard_abilities", [])

        if custom_vice:
            name = custom_vice.strip()
            vice = Vice.objects.filter(name=name).first()
            if vice is None:
                vice = Vice.objects.create(name=name, description="Custom vice")
            validated_data["vice"] = vice
        if vice_details is not None:
            validated_data["vice_details"] = vice_details

        character = super().create(validated_data)

        grades = _grades_from_payload(
            stand_data if isinstance(stand_data, dict) else None,
            self.initial_data.get("coin_stats")
            if isinstance(self.initial_data.get("coin_stats"), dict)
            else None,
        )
        # New characters default missing grades to D (full create), not partial stomp
        for field in _STAND_GRADE_FIELDS:
            grades.setdefault(field, "D")

        stand_type = _stand_type_from_payload(
            stand_data if isinstance(stand_data, dict) else None
        )
        forms_default = ["Humanoid"]
        if isinstance(stand_data, dict) and "forms" in stand_data:
            forms_default = _normalize_stand_forms(stand_data.get("forms")) or [
                "Humanoid"
            ]
        consciousness = "C"
        if isinstance(stand_data, dict):
            c = str(stand_data.get("consciousness_level") or "").strip().upper()[:1]
            if c in _STAND_CONSCIOUSNESS:
                consciousness = c
        type_custom = ""
        if isinstance(stand_data, dict):
            type_custom = str(stand_data.get("type_custom") or "").strip()[:100]

        stand, created = Stand.objects.get_or_create(
            character=character,
            defaults={
                "name": character.stand_name or "Unnamed Stand",
                "type": stand_type,
                "type_custom": type_custom,
                "form": _legacy_form_from_forms(forms_default),
                "forms": forms_default,
                "consciousness_level": consciousness,
                "power": grades["power"],
                "speed": grades["speed"],
                "range": grades["range"],
                "durability": grades["durability"],
                "precision": grades["precision"],
                "development": grades["development"],
                "armor": 0,
            },
        )
        if not created:
            _apply_stand_grades(stand, grades)
            if isinstance(stand_data, dict):
                if stand_data.get("name"):
                    stand.name = stand_data["name"]
                resolved = _stand_type_from_payload(stand_data, default="")
                if resolved:
                    stand.type = resolved
                _apply_stand_identity_fields(stand, stand_data)
            stand.save()
        character.coin_stats = _coin_stats_mirror_from_stand(stand)
        character.save(update_fields=["coin_stats"])
        character._state.fields_cache.pop("stand", None)
        character._state.fields_cache["stand"] = stand

        character.standard_abilities.set(std_ids)
        for ha in hamon_ids:
            CharacterHamonAbility.objects.create(character=character, hamon_ability=ha)
        for sa in spin_ids:
            CharacterSpinAbility.objects.create(character=character, spin_ability=sa)
        _attach_or_create_party_crew_from_personal_name(character)
        req = self.context.get("request")
        _sync_character_progress_clocks(
            character,
            self.initial_data.get("progress_clocks"),
            req.user if req else None,
        )
        return character

    def update(self, instance, validated_data):
        custom_vice = validated_data.pop("custom_vice", None)
        vice_details = validated_data.pop("vice_details", None)
        hamon_ids = validated_data.pop("hamon_ability_ids", None)
        spin_ids = validated_data.pop("spin_ability_ids", None)
        std_ids = validated_data.pop("standard_abilities", None)
        stand_data = self.initial_data.get("stand")
        coin_stats_payload = self.initial_data.get("coin_stats")
        # Never persist client coin_stats as authority; Stand is writable source
        validated_data.pop("coin_stats", None)

        if custom_vice:
            name = custom_vice.strip()
            vice = Vice.objects.filter(name=name).first()
            if vice is None:
                vice = Vice.objects.create(name=name, description="Custom vice")
            validated_data["vice"] = vice
        if vice_details is not None:
            validated_data["vice_details"] = vice_details

        from .services.sheet_patch_guard import (
            character_in_chargen,
            collect_rejected_sheet_patch_fields,
            log_rejected_sheet_patch_fields,
            payload_without_stand_grades,
            sheet_patch_guard_enabled,
            strip_authoritative_patch_fields,
        )

        in_chargen = character_in_chargen(instance)
        guard_enabled = sheet_patch_guard_enabled(self)
        rejected: dict = {}
        if guard_enabled:
            rejected = collect_rejected_sheet_patch_fields(
                instance, self.initial_data
            )
            strip_authoritative_patch_fields(validated_data, in_chargen=in_chargen)
            log_rejected_sheet_patch_fields(instance, rejected)
        self._rejected_sheet_fields = rejected

        character = super().update(instance, validated_data)

        _attach_or_create_party_crew_from_personal_name(character)

        if guard_enabled and not in_chargen:
            stand_data, _coin_stats_ignored = payload_without_stand_grades(
                stand_data, coin_stats_payload
            )

        # Stand nested payload is the only grade write source; coin_stats is a read mirror.
        grades = _grades_from_payload(
            stand_data if isinstance(stand_data, dict) else None,
            None,
        )
        identity_touch = isinstance(stand_data, dict) and any(
            k in stand_data
            for k in (
                "name",
                "type",
                "type_custom",
                "forms",
                "form",
                "consciousness_level",
            )
        )
        if grades or identity_touch:
            stand_type_default = _stand_type_from_payload(
                stand_data if isinstance(stand_data, dict) else None
            )
            stand, created = Stand.objects.get_or_create(
                character=character,
                defaults=_stand_row_defaults_for_create(
                    character, grades, stand_type=stand_type_default
                ),
            )
            if not created:
                # Partial update: only set fields present in payload — never default missing to D
                _apply_stand_grades(stand, grades)
            else:
                # Fresh Stand from get_or_create defaults — still apply any identity fields
                _apply_stand_grades(stand, grades)
            if stand_data and isinstance(stand_data, dict):
                if stand_data.get("name"):
                    stand.name = stand_data["name"]
                resolved = _stand_type_from_payload(stand_data, default="")
                if resolved:
                    stand.type = resolved
                _apply_stand_identity_fields(stand, stand_data)
            stand.save()
            character.coin_stats = _coin_stats_mirror_from_stand(stand)
            character.save(update_fields=["coin_stats"])
            # Reverse OneToOne has no __delete__; stale Stand in fields_cache
            # would make PUT/PATCH response show pre-update forms/type.
            character._state.fields_cache.pop("stand", None)
            character._state.fields_cache["stand"] = stand
        else:
            # Keep mirror coherent if Stand exists
            try:
                if hasattr(character, "stand") and character.stand:
                    character.coin_stats = _coin_stats_mirror_from_stand(character.stand)
                    character.save(update_fields=["coin_stats"])
            except Exception:
                pass

        if std_ids is not None:
            character.standard_abilities.set(std_ids)
        if hamon_ids is not None:
            character.hamon_abilities.all().delete()
            for ha in hamon_ids:
                CharacterHamonAbility.objects.create(
                    character=character, hamon_ability=ha
                )
        if spin_ids is not None:
            character.spin_abilities.all().delete()
            for sa in spin_ids:
                CharacterSpinAbility.objects.create(
                    character=character, spin_ability=sa
                )

        # Slower Recovery → 5-segment healing clock; else default 4
        try:
            slower = character.selected_detriments.filter(
                name__iexact="Slower Recovery"
            ).exists()
            target_segs = 5 if slower else 4
            if int(character.healing_clock_segments or 4) != target_segs:
                character.healing_clock_segments = target_segs
                filled = int(character.healing_clock_filled or 0)
                if filled > target_segs:
                    character.healing_clock_filled = target_segs
                character.save(
                    update_fields=["healing_clock_segments", "healing_clock_filled"]
                )
        except Exception:
            pass

        req = self.context.get("request")
        _sync_character_progress_clocks(
            character,
            self.initial_data.get("progress_clocks"),
            req.user if req else None,
        )
        return character

    def get_hamon_ability_details(self, obj):
        return HamonAbilitySerializer(
            [entry.hamon_ability for entry in obj.hamon_abilities.all()], many=True
        ).data

    def get_spin_ability_details(self, obj):
        return SpinAbilitySerializer(
            [entry.spin_ability for entry in obj.spin_abilities.all()], many=True
        ).data

    def get_standard_ability_details(self, obj):
        return AbilitySerializer(obj.standard_abilities.all(), many=True).data

    def get_trauma_details(self, obj):
        """Resolve Character.trauma JSON list to Trauma rows (integer PKs and legacy string names)."""
        raw = getattr(obj, "trauma", None)
        if not raw or not isinstance(raw, (list, tuple)):
            return TraumaSerializer([], many=True).data

        pks = []
        string_names = []
        for item in raw:
            if isinstance(item, bool):
                continue
            if isinstance(item, int) and item > 0:
                pks.append(item)
            elif isinstance(item, float) and item > 0 and item == int(item):
                pks.append(int(item))
            elif isinstance(item, str):
                s = item.strip()
                if s.isdigit():
                    pks.append(int(s))
                else:
                    string_names.append(s)

        if string_names:
            lower_names = [s.lower() for s in string_names]
            name_map = {
                tr.name.lower(): tr.pk
                for tr in Trauma.objects.annotate(
                    name_lower=Lower("name")
                ).filter(name_lower__in=lower_names)
            }
            for s in string_names:
                pk = name_map.get(s.lower())
                if pk:
                    pks.append(pk)

        if not pks:
            return TraumaSerializer([], many=True).data

        traumas = Trauma.objects.filter(id__in=pks).order_by("id")
        return TraumaSerializer(traumas, many=True).data

class CharacterXPAllocationSerializer(serializers.ModelSerializer):
    summary = serializers.SerializerMethodField()
    allocation_type_display = serializers.CharField(
        source="get_allocation_type_display", read_only=True
    )
    xp_track_display = serializers.CharField(
        source="get_xp_track_display", read_only=True
    )
    can_undo = serializers.SerializerMethodField()
    can_redo = serializers.SerializerMethodField()

    class Meta:
        model = CharacterXPAllocation
        fields = [
            "id",
            "created_at",
            "allocation_type",
            "allocation_type_display",
            "xp_track",
            "xp_track_display",
            "xp_cost",
            "metadata",
            "summary",
            "undone_at",
            "can_undo",
            "can_redo",
        ]
        read_only_fields = fields

    def get_summary(self, obj):
        from .services.xp_allocation import allocation_summary

        return allocation_summary(obj)

    def get_can_undo(self, obj):
        if obj.undone_at:
            return False
        latest_id = self.context.get("latest_undoable_allocation_id")
        if latest_id is None:
            return True
        return obj.id == latest_id

    def get_can_redo(self, obj):
        if not obj.undone_at:
            return False
        latest_id = self.context.get("latest_redoable_allocation_id")
        if latest_id is None:
            return False
        return obj.id == latest_id

class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="That username is already taken. Try another or sign in.",
            )
        ]
    )
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "password"]

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        UserProfile.objects.create(user=user)
        return user

class CharacterSummarySerializer(serializers.ModelSerializer):
    heritage_name = serializers.CharField(
        source="heritage.name", read_only=True, default=None
    )
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    crew_id = serializers.IntegerField(source="crew.id", read_only=True, default=None)
    crew_name = serializers.CharField(source="crew.name", read_only=True, default=None)
    assist_help_pending = serializers.SerializerMethodField()

    def get_assist_help_pending(self, obj):
        """Active campaign session only; one pending +1d per beneficiary per session."""
        pmap = self.context.get("assist_help_pending_map")
        if isinstance(pmap, dict):
            p = pmap.get(obj.id)
            if not p:
                return None
        else:
            sid = self.context.get("campaign_active_session_id")
            if sid is None:
                return None
            p = AssistHelpPending.objects.filter(
                session_id=sid, recipient_id=obj.id
            ).select_related("helper").first()
            if not p:
                return None
        h = p.helper
        name = getattr(h, "true_name", None) or getattr(h, "alias", "") or ""
        if not name:
            name = f"Character {p.helper_id}"
        return {
            "helper_character_id": p.helper_id,
            "helper_name": name,
        }

    class Meta:
        model = Character
        fields = [
            "id",
            "true_name",
            "alias",
            "stand_name",
            "playbook",
            "secondary_playbook",
            "playbook_xp_archetypes",
            "heritage_name",
            "user_id",
            "username",
            "crew_id",
            "crew_name",
            # Portrait (upload or HTTPS URL) for GM session roster / crew lists
            "image",
            "image_url",
            "assist_help_pending",
        ]

class NPCSummarySerializer(serializers.ModelSerializer):
    heritage_name = serializers.CharField(
        source="heritage.name", read_only=True, default=None
    )
    level = serializers.SerializerMethodField()

    def get_level(self, obj):
        return _compute_npc_level(obj.stand_coin_stats)

    class Meta:
        model = NPC
        fields = [
            "id",
            "name",
            "level",
            "stand_name",
            "playbook",
            "heritage_name",
            "image",
            "image_url",
        ]

class CrewCampaignSerializer(serializers.ModelSerializer):
    """Lightweight Crew serializer used inside CampaignSerializer."""

    members = CharacterSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Crew
        fields = [
            "id",
            "name",
            "description",
            "level",
            "hold",
            "rep",
            "wanted_level",
            "coin",
            "xp",
            "advancement_points",
            "members",
            "proposed_name",
        ]

class EquipmentItemSerializer(serializers.ModelSerializer):
    enabled_for_campaign = serializers.SerializerMethodField()
    created_by_username = serializers.SerializerMethodField()

    class Meta:
        model = EquipmentItem
        fields = [
            "id",
            "name",
            "description",
            "category",
            "load_slots",
            "quality",
            "coin_value",
            "scope",
            "campaign",
            "created_by",
            "created_by_username",
            "source_character",
            "available_when_adding",
            "enabled_for_campaign",
        ]
        read_only_fields = ["created_by", "created_by_username"]

    def get_created_by_username(self, obj):
        if obj.created_by_id:
            return obj.created_by.username
        return None

    def get_enabled_for_campaign(self, obj):
        campaign_id = self.context.get("campaign_id")
        if not campaign_id:
            req = self.context.get("request")
            campaign_id = req.query_params.get("campaign") if req else None
        if not campaign_id:
            return None
        try:
            campaign_id = int(campaign_id)
        except (TypeError, ValueError):
            return None
        if obj.scope == "TEMPLATE":
            access = CampaignEquipmentAccess.objects.filter(
                campaign_id=campaign_id, item_id=obj.id
            ).first()
            return access.enabled if access else True
        if obj.scope == "SITE":
            access = CampaignEquipmentAccess.objects.filter(
                campaign_id=campaign_id, item_id=obj.id
            ).first()
            return bool(access and access.enabled)
        if obj.scope == "CAMPAIGN" and obj.campaign_id == campaign_id:
            return obj.available_when_adding
        return False

    def validate(self, attrs):
        scope = attrs.get("scope") or (
            self.instance.scope if self.instance else "CAMPAIGN"
        )
        campaign = attrs.get("campaign") or (
            self.instance.campaign if self.instance else None
        )
        if scope == "CAMPAIGN" and not campaign:
            raise serializers.ValidationError(
                {"campaign": "Campaign items require a campaign."}
            )
        if scope in ("TEMPLATE", "SITE") and campaign:
            attrs["campaign"] = None
        return attrs


class CampaignEquipmentAccessSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignEquipmentAccess
        fields = ["id", "campaign", "item", "enabled"]


class FactionSerializer(serializers.ModelSerializer):
    npcs = NPCSummarySerializer(many=True, read_only=True)
    image = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = Faction
        fields = [
            "id",
            "name",
            "campaign",
            "faction_type",
            "notes",
            "level",
            "hold",
            "reputation",
            "inventory",
            "contacts",
            "faction_status",
            "crew_notes",
            "visible_to_players",
            "image",
            "npcs",
        ]

class ShowcasedNPCSerializer(serializers.ModelSerializer):
    npc = serializers.SerializerMethodField()

    class Meta:
        model = ShowcasedNPC
        fields = [
            "id",
            "campaign",
            "npc",
            "reveal_items",
            "reveal_stand_stats",
            "reveal_faction_status",
            "show_clocks_to_party",
        ]

    def get_npc(self, obj):
        data = {
            "id": obj.npc.id,
            "name": obj.npc.name,
            "stand_name": obj.npc.stand_name or "",
        }
        if obj.reveal_items:
            data["inventory"] = obj.npc.inventory or []
            data["items"] = obj.npc.items or []
        if obj.reveal_stand_stats:
            data["stand_coin_stats"] = obj.npc.stand_coin_stats or {}
        if obj.reveal_faction_status:
            data["faction_status"] = obj.npc.faction_status or {}
        # Only include clock data when GM has enabled show_clocks_to_party
        if obj.show_clocks_to_party:
            data["vulnerability_clock_current"] = obj.npc.vulnerability_clock_current
            data["vulnerability_clock_max"] = obj.npc.vulnerability_clock_max
            data["conflict_clocks"] = obj.npc.conflict_clocks or []
            data["alt_clocks"] = obj.npc.alt_clocks or []
            clocks = list(
                obj.npc.progress_clocks.all().values(
                    "id",
                    "name",
                    "clock_type",
                    "max_segments",
                    "filled_segments",
                    "completed",
                )
            )
            data["progress_clocks"] = clocks
        return data

class ProgressClockSerializer(serializers.ModelSerializer):
    clock_type_display = serializers.CharField(
        source="get_clock_type_display", read_only=True
    )
    created_by = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)
    created_by_username = serializers.SerializerMethodField()
    created_by_character_name = serializers.SerializerMethodField()
    max_segments = serializers.IntegerField(min_value=1, max_value=12, default=4)

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()
        else:
            data = dict(data)
        if data.get("max_segments") in (None, "") and data.get("segments") not in (
            None,
            "",
        ):
            data["max_segments"] = data.get("segments")
        return super().to_internal_value(data)

    def validate(self, attrs):
        max_seg = attrs.get("max_segments")
        if max_seg is None and self.instance is not None:
            max_seg = self.instance.max_segments
        if max_seg is None:
            max_seg = 4
        filled = attrs.get("filled_segments")
        if filled is None and self.instance is not None:
            filled = self.instance.filled_segments
        if filled is None:
            filled = 0
        if filled > max_seg:
            attrs["filled_segments"] = max_seg
        return attrs

    class Meta:
        model = ProgressClock
        fields = [
            "id",
            "name",
            "clock_type",
            "clock_type_display",
            "max_segments",
            "filled_segments",
            "description",
            "campaign",
            "crew",
            "character",
            "faction",
            "session",
            "npc",
            "visible_to_players",
            "visible_to_party",
            "created_by",
            "created_by_username",
            "created_by_character_name",
            "created_at",
            "completed",
        ]

    def get_created_by_username(self, obj):
        u = getattr(obj, "created_by", None)
        return u.username if u else None

    def get_created_by_character_name(self, obj):
        if not obj.created_by_id or not obj.campaign_id:
            return None
        ch = (
            obj.campaign.characters.filter(user_id=obj.created_by_id)
            .only("true_name")
            .first()
        )
        return ch.true_name if ch else None

class CampaignInvitationSerializer(serializers.ModelSerializer):
    invited_user = UserSerializer(read_only=True)
    invited_by = UserSerializer(read_only=True)
    campaign_name = serializers.CharField(source="campaign.name", read_only=True)
    campaign_id = serializers.IntegerField(source="campaign.id", read_only=True)
    campaign_description = serializers.CharField(
        source="campaign.description", read_only=True
    )
    gm = UserSerializer(source="campaign.gm", read_only=True)
    players = UserSerializer(source="campaign.players", many=True, read_only=True)

    class Meta:
        model = CampaignInvitation
        fields = [
            "id",
            "campaign_id",
            "campaign_name",
            "campaign_description",
            "gm",
            "players",
            "invited_user",
            "invited_by",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

class CampaignSerializer(serializers.ModelSerializer):
    gm = UserSerializer(read_only=True)
    players = UserSerializer(many=True, read_only=True)
    wanted_stars = serializers.IntegerField(required=False, default=0)
    factions = FactionSerializer(many=True, read_only=True)
    crews = CrewCampaignSerializer(many=True, read_only=True)
    campaign_characters = serializers.SerializerMethodField()
    campaign_npcs = NPCSummarySerializer(source="npcs", many=True, read_only=True)
    pending_invitations = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(required=False, default=True)
    created_at = serializers.DateTimeField(read_only=True)
    active_session = serializers.PrimaryKeyRelatedField(
        queryset=Session.objects.all(), required=False, allow_null=True
    )
    skip_encoded_xp_settlement = serializers.BooleanField(
        write_only=True,
        required=False,
        default=False,
        help_text=(
            "When PATCH clears or changes active_session, skip automatic "
            "PLAYBOOK_SPECIFIC/STRUGGLE playbook XP for the previous session (still "
            "marks that pass as settled)."
        ),
    )
    active_session_detail = serializers.SerializerMethodField()
    sessions = serializers.SerializerMethodField()
    showcased_npcs = ShowcasedNPCSerializer(many=True, read_only=True)
    current_scene_type = serializers.ChoiceField(
        choices=Campaign.SCENE_TYPE_CHOICES, required=False, default="NONE"
    )
    progress_clocks = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id",
            "name",
            "gm",
            "players",
            "description",
            "wanted_stars",
            "is_active",
            "created_at",
            "factions",
            "crews",
            "campaign_characters",
            "campaign_npcs",
            "pending_invitations",
            "active_session",
            "skip_encoded_xp_settlement",
            "active_session_detail",
            "sessions",
            "showcased_npcs",
            "current_scene_type",
            "progress_clocks",
        ]

    def create(self, validated_data):
        validated_data.pop("skip_encoded_xp_settlement", None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        skip = bool(validated_data.pop("skip_encoded_xp_settlement", False))
        ret = super().update(instance, validated_data)
        setattr(ret, "_skip_encoded_xp_settlement", skip)
        return ret

    def get_pending_invitations(self, obj):
        invitations = obj.invitations.filter(status="pending")
        return CampaignInvitationSerializer(invitations, many=True).data

    def get_campaign_characters(self, obj):
        qs = obj.characters.all().select_related(
            "heritage", "crew", "user"
        ).order_by("id")
        sess_id = getattr(obj, "active_session_id", None)
        pmap = {}
        if sess_id:
            ids = list(qs.values_list("id", flat=True))
            pendings = AssistHelpPending.objects.filter(
                session_id=sess_id, recipient_id__in=ids
            ).select_related("helper")
            pmap = {p.recipient_id: p for p in pendings}
        return CharacterSummarySerializer(
            qs,
            many=True,
            context={
                **self.context,
                "campaign_active_session_id": sess_id,
                "assist_help_pending_map": pmap,
            },
        ).data

    def _npc_row_for_active_session_detail(self, npc, inv, viewer_is_gm_or_staff):
        """Build session NPC clock payload; strip hidden clocks for non-GM viewers."""
        clock_fields = (
            "id",
            "name",
            "clock_type",
            "max_segments",
            "filled_segments",
            "completed",
        )
        if viewer_is_gm_or_staff:
            progress_clocks_full = list(npc.progress_clocks.all().values(*clock_fields))
            return {
                "id": npc.id,
                "name": npc.name,
                "stand_name": npc.stand_name or "",
                "stand_coin_stats": npc.stand_coin_stats or {},
                "abilities": npc.abilities or [],
                "vulnerability_clock_current": npc.vulnerability_clock_current,
                "vulnerability_clock_max": npc.vulnerability_clock_max,
                "conflict_clocks": npc.conflict_clocks or [],
                "alt_clocks": npc.alt_clocks or [],
                "progress_clocks": progress_clocks_full,
                "show_clocks_to_players": inv.show_clocks_to_players,
                "show_vulnerability_clock_to_players": inv.show_vulnerability_clock_to_players,
                "show_stand_coin_to_players": inv.show_stand_coin_to_players,
                "show_all_abilities_to_players": inv.show_all_abilities_to_players,
                "revealed_conflict_clock_names": inv.revealed_conflict_clock_names or [],
                "revealed_alt_clock_names": inv.revealed_alt_clock_names or [],
                "revealed_progress_clock_ids": inv.revealed_progress_clock_ids or [],
                "revealed_stand_coin_stats": inv.revealed_stand_coin_stats or [],
                "revealed_ability_names": inv.revealed_ability_names or [],
            }
        show_all = inv.show_clocks_to_players
        show_vuln = inv.show_clocks_to_players or inv.show_vulnerability_clock_to_players
        revealed_conflict = set(inv.revealed_conflict_clock_names or [])
        revealed_alt = set(inv.revealed_alt_clock_names or [])
        revealed_progress_ids = set(inv.revealed_progress_clock_ids or [])
        base_progress = list(npc.progress_clocks.all().values(*clock_fields))
        if show_all:
            progress_clocks = base_progress
        else:
            progress_clocks = [
                c for c in base_progress if int(c.get("id") or 0) in revealed_progress_ids
            ]
        # When Master "Clocks" (show_clocks_to_players) is off, rely only on
        # session reveal lists—not per-clock JSON flags on the NPC—which would
        # bypass what the GM expects from the session toggle (see SessionNPCInvolvement).
        conflict_clocks = (
            npc.conflict_clocks
            if show_all
            else [
                c
                for c in (npc.conflict_clocks or [])
                if str(c.get("name") or "") in revealed_conflict
            ]
        )
        alt_clocks = (
            npc.alt_clocks
            if show_all
            else [
                c
                for c in (npc.alt_clocks or [])
                if str(c.get("name") or "") in revealed_alt
            ]
        )
        stand_stats = {}
        if inv.show_stand_coin_to_players:
            revealed_stats = [str(k).upper() for k in (inv.revealed_stand_coin_stats or [])]
            if revealed_stats:
                for key in revealed_stats:
                    if key in (npc.stand_coin_stats or {}):
                        stand_stats[key] = npc.stand_coin_stats.get(key)
            else:
                stand_stats = npc.stand_coin_stats or {}
        abilities = []
        if inv.show_all_abilities_to_players:
            abilities = npc.abilities or []
        elif inv.revealed_ability_names:
            allowed = {str(name).strip().lower() for name in inv.revealed_ability_names}
            abilities = [
                ab
                for ab in (npc.abilities or [])
                if str((ab or {}).get("name", "")).strip().lower() in allowed
            ]
        player_visible = bool(
            show_all
            or show_vuln
            or conflict_clocks
            or alt_clocks
            or progress_clocks
            or stand_stats
            or abilities
        )
        return {
            "id": npc.id,
            "name": npc.name,
            "stand_name": npc.stand_name or "",
            "stand_coin_stats": stand_stats,
            "abilities": abilities,
            "vulnerability_clock_current": (
                npc.vulnerability_clock_current if show_vuln else 0
            ),
            "vulnerability_clock_max": npc.vulnerability_clock_max if show_vuln else 0,
            "conflict_clocks": conflict_clocks or [],
            "alt_clocks": alt_clocks or [],
            "progress_clocks": progress_clocks,
            "_player_visible": player_visible,
        }

    def get_active_session_detail(self, obj):
        if not obj.active_session_id:
            return None
        s = obj.active_session
        if s.campaign_id != obj.id:
            return None
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        viewer_is_gm_or_staff = bool(
            user
            and getattr(user, "is_authenticated", False)
            and (getattr(user, "is_staff", False) or obj.gm_id == user.id)
        )
        base_qs = s.npc_involvements.select_related("npc")
        if not viewer_is_gm_or_staff:
            base_qs = base_qs.filter(npc__campaign_id=obj.id)
        involvements = list(base_qs.order_by("npc__name"))
        # Minimal roster for any viewer (e.g. PC spends coin on NPC heal fortune);
        # not filtered by session visibility toggles.
        session_npc_heal_roster = [
            {
                "id": inv.npc_id,
                "name": (inv.npc.name or "").strip() or "NPC",
                "heal_quality_fortune_dice": max(
                    1,
                    min(
                        4,
                        int(
                            getattr(inv.npc, "heal_quality_fortune_dice", 2) or 2
                        ),
                    ),
                ),
            }
            for inv in involvements
        ]
        session_npcs_with_clocks = []
        for inv in involvements:
            npc = inv.npc
            row = self._npc_row_for_active_session_detail(
                npc, inv, viewer_is_gm_or_staff
            )
            if not viewer_is_gm_or_staff and not row.pop("_player_visible", False):
                continue
            row.pop("_player_visible", None)
            session_npcs_with_clocks.append(row)
        # session_date is auto_now_add but guard None for robustness and ORM edge cases.
        if s.session_date is None:
            session_number = Session.objects.filter(
                campaign=obj, pk__lte=s.pk
            ).count()
        else:
            session_number = (
                Session.objects.filter(campaign=obj)
                .filter(
                    Q(session_date__lt=s.session_date)
                    | Q(session_date=s.session_date, pk__lte=s.pk)
                )
                .count()
            )
        return {
            "id": s.id,
            "name": s.name,
            "session_number": session_number,
            "session_date": s.session_date,
            "proposed_date": s.proposed_date.isoformat() if s.proposed_date else None,
            "description": s.description,
            "objective": s.objective,
            "show_position_effect_to_players": getattr(
                s, "show_position_effect_to_players", True
            ),
            "default_position": getattr(s, "default_position", "risky") or "risky",
            "default_effect": getattr(s, "default_effect", "standard") or "standard",
            "roll_goal_label": getattr(s, "roll_goal_label", "") or "",
            "roll_goal_by_character": getattr(s, "roll_goal_by_character", None)
            or {},
            "devils_bargain_by_character": getattr(
                s, "devils_bargain_by_character", None
            )
            or {},
            "ripple_breathing_free_push_claimed_by_character": getattr(
                s, "ripple_breathing_free_push_claimed_by_character", None
            )
            or {},
            "position_effect_by_character": getattr(
                s, "position_effect_by_character", None
            )
            or {},
            "loadout_by_character": getattr(s, "loadout_by_character", None) or {},
            "session_npcs_with_clocks": session_npcs_with_clocks,
            "session_npc_heal_roster": session_npc_heal_roster,
        }

    def get_sessions(self, obj):
        sessions = obj.sessions.all().order_by("-session_date")[:50]
        return [
            {
                "id": s.id,
                "name": s.name,
                "session_date": s.session_date,
                "proposed_date": s.proposed_date.isoformat() if s.proposed_date else None,
                "status": s.status,
                "auto_encoded_xp_settled": bool(s.auto_encoded_xp_settled),
            }
            for s in sessions
        ]

    def get_progress_clocks(self, obj):
        request = self.context.get("request")
        if not request or not request.user:
            return []
        is_gm = obj.gm_id == request.user.id
        clocks = obj.progress_clocks.all()
        if is_gm or request.user.is_staff:
            return ProgressClockSerializer(clocks, many=True).data
        user = request.user
        clocks = clocks.filter(
            Q(npc__isnull=True) | Q(npc__campaign_id=obj.id)
        )
        showcased_npc_ids = list(obj.showcased_npcs.values_list("npc_id", flat=True))
        campaign_player_ids = list(obj.players.values_list("id", flat=True)) + list(
            obj.characters.values_list("user_id", flat=True).distinct()
        )
        active_sid = getattr(obj, "active_session_id", None)
        gm_public_session = Q(session__isnull=True)
        if active_sid:
            gm_public_session |= Q(session_id=active_sid)
        legacy_gm_session_visible = (
            Q(
                created_by__isnull=True,
                visible_to_players=True,
                session_id=active_sid,
            )
            if active_sid
            else Q(pk__in=[])
        )
        clocks = clocks.filter(
            Q(
                Q(created_by__isnull=True, visible_to_players=True)
                & (Q(npc__isnull=True) | Q(npc_id__in=showcased_npc_ids))
            )
            | Q(created_by_id=user.id)
            | Q(visible_to_party=True, created_by_id__in=campaign_player_ids)
            | (
                Q(created_by_id=obj.gm_id, visible_to_players=True)
                & gm_public_session
            )
            | legacy_gm_session_visible
        )
        return ProgressClockSerializer(clocks, many=True).data

class NPCSerializer(serializers.ModelSerializer):
    creator = serializers.PrimaryKeyRelatedField(
        read_only=True, default=serializers.CurrentUserDefault()
    )
    heritage = FlexibleHeritagePrimaryKeyField(
        queryset=Heritage.objects.all(), allow_null=True, required=False
    )
    heritage_details = HeritageSerializer(source="heritage", read_only=True)
    selected_benefits = serializers.PrimaryKeyRelatedField(
        queryset=Benefit.objects.all(), many=True, required=False
    )
    selected_detriments = serializers.PrimaryKeyRelatedField(
        queryset=Detriment.objects.all(), many=True, required=False
    )
    vulnerability_clock_max = serializers.IntegerField(read_only=True)
    vulnerability_clock_current = serializers.IntegerField(required=False)
    image = serializers.FileField(required=False, allow_null=True)
    hamon_ability_ids = serializers.PrimaryKeyRelatedField(
        queryset=HamonAbility.objects.all(), many=True, write_only=True, required=False
    )
    spin_ability_ids = serializers.PrimaryKeyRelatedField(
        queryset=SpinAbility.objects.all(), many=True, write_only=True, required=False
    )
    selected_hamon_abilities = serializers.SerializerMethodField()
    selected_spin_abilities = serializers.SerializerMethodField()
    level = serializers.SerializerMethodField()

    def get_level(self, obj):
        return _compute_npc_level(obj.stand_coin_stats)

    def get_selected_hamon_abilities(self, obj):
        return list(obj.npc_hamon_abilities.values_list("hamon_ability_id", flat=True))

    def get_selected_spin_abilities(self, obj):
        return list(obj.npc_spin_abilities.values_list("spin_ability_id", flat=True))

    class Meta:
        model = NPC
        fields = [
            "id",
            "name",
            "level",
            "appearance",
            "role",
            "weakness",
            "need",
            "desire",
            "rumour",
            "secret",
            "passion",
            "description",
            "stand_coin_stats",
            "stand_name",
            "heritage",
            "heritage_details",
            "selected_benefits",
            "selected_detriments",
            "playbook",
            "custom_abilities",
            "abilities",
            "hamon_ability_ids",
            "spin_ability_ids",
            "selected_hamon_abilities",
            "selected_spin_abilities",
            "relationships",
            "vulnerability_clock_current",
            "creator",
            "campaign",
            "faction",
            "image",
            "image_url",
            "stand_description",
            "stand_appearance",
            "stand_manifestation",
            "special_traits",
            "vulnerability_clock_max",
            "purveyor",
            "notes",
            "inventory_notes",
            "items",
            "contacts",
            "faction_status",
            "inventory",
            "conflict_clocks",
            "alt_clocks",
            "heal_quality_fortune_dice",
            "heal_recover_in_play_position",
            "heal_recover_in_play_effect",
        ]

    def create(self, validated_data):
        hamon_ids = validated_data.pop("hamon_ability_ids", [])
        spin_ids = validated_data.pop("spin_ability_ids", [])
        if "inventory" in validated_data:
            validated_data["inventory"] = normalize_inventory_list(
                validated_data.get("inventory")
            )
        if "creator" not in validated_data:
            validated_data["creator"] = self.context["request"].user
        npc = super().create(validated_data)
        NPCHamonAbility.objects.bulk_create(
            [NPCHamonAbility(npc=npc, hamon_ability=ability) for ability in hamon_ids]
        )
        NPCSpinAbility.objects.bulk_create(
            [NPCSpinAbility(npc=npc, spin_ability=ability) for ability in spin_ids]
        )
        return npc

    def update(self, instance, validated_data):
        hamon_ids = validated_data.pop("hamon_ability_ids", None)
        spin_ids = validated_data.pop("spin_ability_ids", None)
        if "inventory" in validated_data:
            validated_data["inventory"] = normalize_inventory_list(
                validated_data.get("inventory")
            )
        instance = super().update(instance, validated_data)
        if hamon_ids is not None:
            instance.npc_hamon_abilities.all().delete()
            NPCHamonAbility.objects.bulk_create(
                [
                    NPCHamonAbility(npc=instance, hamon_ability=ability)
                    for ability in hamon_ids
                ]
            )
        if spin_ids is not None:
            instance.npc_spin_abilities.all().delete()
            NPCSpinAbility.objects.bulk_create(
                [
                    NPCSpinAbility(npc=instance, spin_ability=ability)
                    for ability in spin_ids
                ]
            )
        return instance

class TraumaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trauma
        fields = ["id", "name", "description"]
