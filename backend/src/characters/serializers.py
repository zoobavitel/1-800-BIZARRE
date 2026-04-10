import json
import time

from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from django.contrib.auth.models import User
from .models import (
    UserProfile, Heritage, Vice, Ability, Character, Stand,
    Campaign, CampaignInvitation, NPC, Crew, Detriment, Benefit, StandAbility,
    HamonAbility, SpinAbility, Trauma,
    CharacterHamonAbility, CharacterSpinAbility,
    NPCHamonAbility, NPCSpinAbility,
    CharacterHistory, ExperienceTracker, Session, SessionEvent, SessionNPCInvolvement,
    Claim, CrewPlaybook, CrewSpecialAbility, CrewUpgrade, XPHistory, StressHistory, ChatMessage,
    Faction, ShowcasedNPC, ProgressClock, Roll, GroupAction
)
class ClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = Claim
        fields = '__all__'

class CrewSpecialAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = CrewSpecialAbility
        fields = '__all__'

class CrewPlaybookSerializer(serializers.ModelSerializer):
    claims = ClaimSerializer(many=True, read_only=True)
    special_abilities = CrewSpecialAbilitySerializer(many=True, read_only=True)

    class Meta:
        model = CrewPlaybook
        fields = '__all__'

class CrewUpgradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrewUpgrade
        fields = '__all__'

class CrewSerializer(serializers.ModelSerializer):
    playbook = CrewPlaybookSerializer(read_only=True)
    claims = ClaimSerializer(many=True, read_only=True)
    special_abilities = CrewSpecialAbilitySerializer(many=True, read_only=True)
    proposed_by = serializers.PrimaryKeyRelatedField(read_only=True)
    approved_by = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    image = serializers.FileField(required=False)

    class Meta:
        model = Crew
        fields = [
            'id', 'name', 'campaign', 'playbook', 'description', 'image',
            'xp', 'xp_track_size', 'advancement_points',
            'level', 'hold', 'rep', 'wanted_level',
            'coin', 'stash', 'stash_slots', 'claims', 'upgrade_progress', 'special_abilities',
            'proposed_name', 'proposed_by', 'approved_by'
        ]

    def validate_stash_slots(self, value):
        if value is None:
            return value
        if not isinstance(value, list):
            raise serializers.ValidationError('stash_slots must be a list.')
        if len(value) != 40:
            raise serializers.ValidationError('stash_slots must have exactly 40 boolean elements.')
        for i, x in enumerate(value):
            if not isinstance(x, bool):
                raise serializers.ValidationError(f'stash_slots[{i}] must be a boolean.')
        return value


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            'avatar', 'signature', 'display_title', 'show_avatars', 'show_signatures',
            'theme', 'email_digest', 'email_digest_days', 'receive_all_email',
            'notification_preferences',
        ]

class InvitableUserSerializer(serializers.ModelSerializer):
    """Lightweight serializer for invitable users list (id, username only)."""
    class Meta:
        model = User
        fields = ['id', 'username']


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer()

    class Meta:
        model = User
        fields = ['id', 'username', 'profile']

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        profile = instance.profile

        instance.username = validated_data.get('username', instance.username)
        instance.save()

        for field in ['avatar', 'signature', 'display_title', 'show_avatars', 'show_signatures',
                      'theme', 'email_digest', 'email_digest_days', 'receive_all_email',
                      'notification_preferences']:
            if field in profile_data:
                setattr(profile, field, profile_data[field])
        profile.save()

        return instance

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

class SessionNPCInvolvementWriteSerializer(serializers.Serializer):
    """For PATCH: {npc: id, show_clocks_to_players: bool}"""
    npc = serializers.PrimaryKeyRelatedField(queryset=NPC.objects.all())
    show_clocks_to_players = serializers.BooleanField(default=False)


class SessionSerializer(serializers.ModelSerializer):
    npcs_involved = serializers.SerializerMethodField()
    npc_involvements = serializers.SerializerMethodField()
    characters_involved = serializers.PrimaryKeyRelatedField(many=True, queryset=Character.objects.all(), required=False)
    proposed_by = UserSerializer(read_only=True)
    votes = UserSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = '__all__'
        read_only_fields = ['session_date']

    def get_npcs_involved(self, obj):
        """Return list of NPC ids for backward compatibility."""
        return list(obj.npcs_involved.values_list('id', flat=True))

    def get_npc_involvements(self, obj):
        """Return [{npc: id, show_clocks_to_players: bool}, ...] for GM controls."""
        return [
            {'npc': inv.npc_id, 'show_clocks_to_players': inv.show_clocks_to_players}
            for inv in obj.npc_involvements.select_related('npc').order_by('npc__name')
        ]

    def update(self, instance, validated_data):
        npc_involvements_data = self.initial_data.get('npc_involvements')
        npcs_involved_data = self.initial_data.get('npcs_involved')
        validated_data.pop('npcs_involved', None)
        validated_data.pop('npc_involvements', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if npc_involvements_data is not None:
            instance.npc_involvements.all().delete()
            for item in npc_involvements_data:
                npc_id = item.get('npc') if isinstance(item, dict) else item
                show = item.get('show_clocks_to_players', False) if isinstance(item, dict) else False
                npc = NPC.objects.get(pk=npc_id) if isinstance(npc_id, int) else npc_id
                SessionNPCInvolvement.objects.create(
                    session=instance, npc=npc, show_clocks_to_players=show
                )
        elif npcs_involved_data is not None:
            existing = {inv.npc_id: inv for inv in instance.npc_involvements.all()}
            new_ids = set(npcs_involved_data)
            for npc_id in new_ids:
                if npc_id in existing:
                    continue
                SessionNPCInvolvement.objects.get_or_create(
                    session=instance, npc_id=npc_id, defaults={'show_clocks_to_players': False}
                )
            for npc_id in list(existing.keys()):
                if npc_id not in new_ids:
                    instance.npc_involvements.filter(npc_id=npc_id).delete()

        return instance

    def create(self, validated_data):
        npc_involvements_data = self.initial_data.get('npc_involvements')
        npcs_involved_data = self.initial_data.get('npcs_involved')
        validated_data.pop('npcs_involved', None)
        validated_data.pop('npc_involvements', None)
        instance = super().create(validated_data)
        if npc_involvements_data is not None:
            for item in npc_involvements_data:
                npc_id = item.get('npc') if isinstance(item, dict) else item
                show = item.get('show_clocks_to_players', False) if isinstance(item, dict) else False
                npc = NPC.objects.get(pk=npc_id) if isinstance(npc_id, int) else npc_id
                SessionNPCInvolvement.objects.create(
                    session=instance, npc=npc, show_clocks_to_players=show
                )
        elif npcs_involved_data is not None:
            for npc_id in npcs_involved_data:
                SessionNPCInvolvement.objects.get_or_create(
                    session=instance, npc_id=npc_id, defaults={'show_clocks_to_players': False}
                )
        return instance


class XPHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = XPHistory
        fields = '__all__'

class StressHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = StressHistory
        fields = '__all__'

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = '__all__'

class SessionEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionEvent
        fields = '__all__'
        read_only_fields = ['timestamp']


class ExperienceTrackerSerializer(serializers.ModelSerializer):
    character = serializers.PrimaryKeyRelatedField(queryset=Character.objects.all())
    session = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)
    trigger_display = serializers.CharField(source='get_trigger_display', read_only=True)

    class Meta:
        model = ExperienceTracker
        fields = ['id', 'character', 'session', 'session_date', 'trigger', 'trigger_display', 'description', 'xp_gained']
        read_only_fields = ['session_date', 'session']


class GroupActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupAction
        fields = ['id', 'session', 'leader', 'goal_label', 'status', 'created_at']
        read_only_fields = ['status', 'created_at']


class RollSerializer(serializers.ModelSerializer):
    character_name = serializers.CharField(source='character.true_name', read_only=True)
    rolled_by_username = serializers.CharField(source='rolled_by.username', read_only=True)
    xp_awarded = serializers.SerializerMethodField()

    class Meta:
        model = Roll
        fields = [
            'id', 'character', 'character_name', 'session', 'roll_type', 'action_name',
            'position', 'effect', 'dice_pool', 'results', 'outcome', 'description', 'goal_label',
            'group_action',
            'rolled_by', 'rolled_by_username', 'timestamp', 'xp_awarded',
            'pool_action_rating', 'pool_attribute_dice', 'push_for_effect', 'push_for_dice',
            'uses_devil_bargain', 'pool_assist_dice', 'pool_bonus_dice', 'roller_stress_spent',
            'devil_bargain_consequence',
        ]
        read_only_fields = ['timestamp', 'rolled_by']

    def validate_effect(self, value):
        from .roll_helpers import normalize_effect
        return normalize_effect(value)

    def get_xp_awarded(self, obj):
        from .models import ExperienceTracker
        return ExperienceTracker.objects.filter(roll=obj).exists()


class SessionRecordsSerializer(serializers.ModelSerializer):
    """Extended session serializer with events, xp_history, stress_history, rolls for session records view."""
    npcs_involved = serializers.SerializerMethodField()
    npc_involvements = serializers.SerializerMethodField()
    characters_involved = serializers.PrimaryKeyRelatedField(many=True, queryset=Character.objects.all(), required=False)
    proposed_by = UserSerializer(read_only=True)
    votes = UserSerializer(many=True, read_only=True)
    events = SessionEventSerializer(many=True, read_only=True)
    xp_history = XPHistorySerializer(source='session_xp_history', many=True, read_only=True)
    stress_history = StressHistorySerializer(source='session_stress_history', many=True, read_only=True)
    xp_entries = ExperienceTrackerSerializer(many=True, read_only=True)
    rolls = RollSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = [
            'id', 'campaign', 'name', 'session_date', 'description', 'objective',
            'planned_for_next_session', 'status', 'npcs_involved', 'npc_involvements', 'characters_involved',
            'proposed_score_target', 'proposed_score_description', 'proposed_by', 'votes',
            'events', 'xp_history', 'stress_history', 'xp_entries', 'rolls',
            'roll_goal_label', 'show_position_effect_to_players', 'default_position', 'default_effect',
            'devils_bargain_by_character',
        ]

    def get_npcs_involved(self, obj):
        return list(obj.npcs_involved.values_list('id', flat=True))

    def get_npc_involvements(self, obj):
        return [
            {'npc': inv.npc_id, 'show_clocks_to_players': inv.show_clocks_to_players}
            for inv in obj.npc_involvements.select_related('npc').order_by('npc__name')
        ]


class CharacterHistorySerializer(serializers.ModelSerializer):
    editor = serializers.StringRelatedField()

    class Meta:
        model = CharacterHistory
        fields = ['id', 'character', 'editor', 'timestamp', 'changed_fields']


class BenefitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Benefit
        fields = ['id', 'name', 'hp_cost', 'required', 'description']

class DetrimentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Detriment
        fields = ['id', 'name', 'hp_value', 'required', 'description']

class HeritageSerializer(serializers.ModelSerializer):
    benefits = BenefitSerializer(many=True, read_only=True)
    detriments = DetrimentSerializer(many=True, read_only=True)

    class Meta:
        model = Heritage
        fields = ['id', 'name', 'base_hp', 'description', 'benefits', 'detriments']


class FlexibleHeritagePrimaryKeyField(serializers.PrimaryKeyRelatedField):
    """Accepts heritage id (int or numeric string) or heritage display name (e.g. Human)."""

    def to_internal_value(self, data):
        if data is None:
            if self.required:
                self.fail('required')
            return None
        queryset = self.get_queryset()
        if isinstance(data, Heritage):
            if not queryset.filter(pk=data.pk).exists():
                self.fail('does_not_exist', pk_name=data.pk)
            return data
        if isinstance(data, int):
            return queryset.get(pk=data)
        if isinstance(data, str):
            s = data.strip()
            if not s:
                if self.allow_null:
                    return None
                self.fail('invalid')
            if s.isdigit():
                return queryset.get(pk=int(s))
            match = queryset.filter(name__iexact=s).first()
            if match is not None:
                return match
            self.fail('does_not_exist', pk_name=s)
        return super().to_internal_value(data)


class ViceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vice
        fields = '__all__'

class AbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Ability
        fields = ['id', 'name', 'description', 'type', 'category']

class StandAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = StandAbility
        fields = ['id','stand','name','description']

class HamonAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = HamonAbility
        fields = ['id', 'name', 'hamon_type', 'description', 'required_a_count', 'stress_cost', 'frequency']

class SpinAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SpinAbility
        fields = ['id', 'name', 'spin_type', 'description', 'required_a_count', 'stress_cost', 'frequency']

class StandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stand
        fields = '__all__'



class CharacterSerializer(serializers.ModelSerializer):
    image = serializers.FileField(required=False)
    heritage = FlexibleHeritagePrimaryKeyField(
        queryset=Heritage.objects.all(), allow_null=True, required=False
    )
    # display current campaign's wanted stars
    wanted_stars = serializers.IntegerField(source='campaign.wanted_stars', read_only=True)
    stand = StandSerializer(read_only=True)
    crew = CrewSerializer(read_only=True)
    crew_id = serializers.PrimaryKeyRelatedField(
        source='crew',
        queryset=Crew.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    heritage_details = HeritageSerializer(source='heritage', read_only=True)
    # nested vice info
    vice_info = ViceSerializer(source='vice', read_only=True)
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

    custom_vice = serializers.CharField(write_only=True, required=False, allow_blank=True)
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
        fields = '__all__'

    def validate_coin_boxes(self, value):
        if value is None:
            return value
        if not isinstance(value, list):
            raise serializers.ValidationError('coin_boxes must be a list.')
        if len(value) != 4:
            raise serializers.ValidationError('coin_boxes must have exactly 4 boolean elements.')
        for i, x in enumerate(value):
            if not isinstance(x, bool):
                raise serializers.ValidationError(f'coin_boxes[{i}] must be a boolean.')
        return value

    def validate_stash_slots(self, value):
        if value is None:
            return value
        if not isinstance(value, list):
            raise serializers.ValidationError('stash_slots must be a list.')
        if len(value) != 40:
            raise serializers.ValidationError('stash_slots must have exactly 40 boolean elements.')
        for i, x in enumerate(value):
            if not isinstance(x, bool):
                raise serializers.ValidationError(f'stash_slots[{i}] must be a boolean.')
        return value

    def validate(self, data):
        # Validate stress/trauma system
        stress = data.get('stress', 0) or getattr(self.instance, 'stress', 0)
        trauma_list = data.get('trauma', []) or getattr(self.instance, 'trauma', [])
        
        # Check if character should take trauma at 11+ stress
        if stress >= 11:
            trauma_count = len(trauma_list)
            if trauma_count >= 4:
                raise serializers.ValidationError(
                    "Character is dead (4+ trauma). Cannot continue playing."
                )
            # Note: We don't auto-add trauma here, that's handled by the frontend
        
        # enforce playbook ability prerequisites based on coin_stats (A-rank only; S does not count)
        coin_stats = data.get('coin_stats') or getattr(self.instance, 'coin_stats', {})
        count_A = sum(1 for v in coin_stats.values() if v == 'A')
        hamon_ids = data.get('hamon_ability_ids', [])
        spin_ids = data.get('spin_ability_ids', [])
        playbook_val = data.get('playbook')
        if playbook_val is None and self.instance:
            playbook_val = self.instance.playbook
        if playbook_val is None:
            playbook_val = 'STAND'

        for ha in hamon_ids:
            if count_A < ha.required_a_count:
                raise serializers.ValidationError(
                    f"Insufficient 'A' ratings: need {ha.required_a_count} 'A' coin stats for Hamon ability '{ha.name}' (you have {count_A})."
                )
        for sa in spin_ids:
            if count_A < sa.required_a_count:
                raise serializers.ValidationError(
                    f"Insufficient 'A' ratings: need {sa.required_a_count} 'A' coin stats for Spin ability '{sa.name}' (you have {count_A})."
                )
        if hamon_ids and playbook_val != 'HAMON':
            raise serializers.ValidationError('Hamon abilities require playbook HAMON.')
        if spin_ids and playbook_val != 'SPIN':
            raise serializers.ValidationError('Spin abilities require playbook SPIN.')
        heritage   = data.get('heritage') or getattr(self.instance, 'heritage', None)
        benefits   = data.get('selected_benefits', [])
        detriments = data.get('selected_detriments', [])
        bonus_hp   = data.get('bonus_hp_from_xp', 0)

        if not heritage:
            raise serializers.ValidationError("You must pick a Heritage.")

        base_hp = heritage.base_hp + bonus_hp
        gain    = sum(d.hp_value for d in detriments)
        cost    = sum(b.hp_cost  for b in benefits)

        if base_hp + gain < cost:
            raise serializers.ValidationError(
                f"HP budget exceeded (base {base_hp} + detriments {gain} < benefits {cost})."
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
        action_dots = data.get('action_dots') or getattr(self.instance, 'action_dots', {})
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
        # Enforce playbook XP track cap at 10 XP
        xp_clocks = data.get('xp_clocks') or getattr(self.instance, 'xp_clocks', {})
        playbook_xp = xp_clocks.get('playbook', 0)
        if playbook_xp > 10:
            raise serializers.ValidationError(
                f"Playbook track XP cannot exceed 10; received {playbook_xp}."
            )
        
        # GM character locking validation
        if self.instance and self.instance.campaign:
            gm_locked = data.get('gm_character_locked') or getattr(self.instance, 'gm_character_locked', False)
            allowed_fields = data.get('gm_allowed_edit_fields') or getattr(self.instance, 'gm_allowed_edit_fields', {})
            
            # Only GM can modify locking settings
            request = self.context.get('request')
            if request and hasattr(request, 'user'):
                is_gm = self.instance.campaign.gm == request.user
                
                if gm_locked and not is_gm:
                    # Check if any locked fields are being modified
                    restricted_fields = ['heritage', 'selected_benefits', 'selected_detriments', 'playbook']
                    for field in restricted_fields:
                        if field in data and not allowed_fields.get(field, True):
                            raise serializers.ValidationError(
                                f"Field '{field}' is locked by GM and cannot be modified."
                            )

        # Crew assignment (client sends crew_id; internal key is crew)
        request = self.context.get('request')
        if 'crew' in data:
            if not request or not getattr(request, 'user', None) or not request.user.is_authenticated:
                raise serializers.ValidationError({'crew_id': 'Authentication required.'})
            new_crew = data['crew']
            campaign = data.get('campaign')
            if self.instance is not None:
                if campaign is None:
                    campaign = self.instance.campaign
                elif not hasattr(campaign, 'id'):
                    try:
                        campaign = Campaign.objects.get(pk=campaign) if campaign is not None else None
                    except Campaign.DoesNotExist:
                        campaign = None
            elif campaign is not None and not hasattr(campaign, 'id'):
                try:
                    campaign = Campaign.objects.get(pk=campaign)
                except Campaign.DoesNotExist:
                    campaign = None

            if new_crew is not None:
                if campaign is None:
                    raise serializers.ValidationError(
                        {'crew_id': 'Assign the character to a campaign before joining a crew.'}
                    )
                c_id = campaign.id if hasattr(campaign, 'id') else campaign
                if new_crew.campaign_id != c_id:
                    raise serializers.ValidationError(
                        {'crew_id': 'Crew must belong to the same campaign as the character.'}
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
                        {'crew_id': 'You cannot change this character\'s crew.'}
                    )

        return data

    def create(self, validated_data):
        custom_vice = validated_data.pop('custom_vice', None)
        vice_details = validated_data.pop('vice_details', None)
        stand_data = self.initial_data.get('stand')
        coin_stats = validated_data.get('coin_stats', {})
        hamon_ids = validated_data.pop('hamon_ability_ids', [])
        spin_ids = validated_data.pop('spin_ability_ids', [])
        std_ids = validated_data.pop('standard_abilities', [])

        if custom_vice:
            name = custom_vice.strip()
            vice = Vice.objects.filter(name=name).first()
            if vice is None:
                vice = Vice.objects.create(name=name, description='Custom vice')
            validated_data['vice'] = vice
        if vice_details is not None:
            validated_data['vice_details'] = vice_details

        # create character instance and assign m2m
        character = super().create(validated_data)

        # Create Stand if we have coin_stats or stand data (required for validation)
        stats = stand_data or coin_stats
        if stats and isinstance(stats, dict):
            Stand.objects.get_or_create(
                character=character,
                defaults={
                    'name': character.stand_name or 'Unnamed Stand',
                    'type': 'FIGHTING',
                    'form': 'Humanoid',
                    'consciousness_level': 'C',
                    'power': str(stats.get('power', 'D')).upper()[:1],
                    'speed': str(stats.get('speed', 'D')).upper()[:1],
                    'range': str(stats.get('range', 'D')).upper()[:1],
                    'durability': str(stats.get('durability', 'D')).upper()[:1],
                    'precision': str(stats.get('precision', 'D')).upper()[:1],
                    'development': str(stats.get('development', 'D')).upper()[:1],
                    'armor': 0,
                }
            )

        character.standard_abilities.set(std_ids)
        for ha in hamon_ids:
            CharacterHamonAbility.objects.create(character=character, hamon_ability=ha)
        for sa in spin_ids:
            CharacterSpinAbility.objects.create(character=character, spin_ability=sa)
        if character.crew_id and character.personal_crew_name:
            Character.objects.filter(pk=character.pk).update(personal_crew_name='')
            character.personal_crew_name = ''
        return character
    
    def update(self, instance, validated_data):
        # #region agent log
        try:
            _req = self.context.get('request')
            _files = list(getattr(_req, 'FILES', {}).keys()) if _req else []
            with open('/home/z/git/1-800-BIZARRE/.cursor/debug-af48c2.log', 'a') as _f:
                _f.write(json.dumps({
                    'sessionId': 'af48c2',
                    'hypothesisId': 'H1-H4',
                    'location': 'serializers.py:CharacterSerializer.update:entry',
                    'message': 'character update entry',
                    'data': {
                        'initial_custom_vice': self.initial_data.get('custom_vice'),
                        'initial_vice': self.initial_data.get('vice'),
                        'initial_vice_details_len': len(str(self.initial_data.get('vice_details') or '')),
                        'validated_custom_vice': validated_data.get('custom_vice'),
                        'validated_has_vice_key': 'vice' in validated_data,
                        'validated_has_image_key': 'image' in validated_data,
                        'instance_vice_id_before': getattr(instance, 'vice_id', None),
                        'files_keys': _files,
                    },
                    'timestamp': int(time.time() * 1000),
                }) + '\n')
        except Exception:
            pass
        # #endregion
        custom_vice = validated_data.pop('custom_vice', None)
        vice_details = validated_data.pop('vice_details', None)
        hamon_ids = validated_data.pop('hamon_ability_ids', None)
        spin_ids = validated_data.pop('spin_ability_ids', None)
        std_ids = validated_data.pop('standard_abilities', None)
        stand_data = self.initial_data.get('stand')
        coin_stats = validated_data.get('coin_stats') or (stand_data if isinstance(stand_data, dict) else {})

        if custom_vice:
            name = custom_vice.strip()
            vice = Vice.objects.filter(name=name).first()
            if vice is None:
                vice = Vice.objects.create(name=name, description='Custom vice')
            validated_data['vice'] = vice
        if vice_details is not None:
            validated_data['vice_details'] = vice_details

        # #region agent log
        try:
            with open('/home/z/git/1-800-BIZARRE/.cursor/debug-af48c2.log', 'a') as _f:
                _f.write(json.dumps({
                    'sessionId': 'af48c2',
                    'hypothesisId': 'H2-H3',
                    'location': 'serializers.py:CharacterSerializer.update:before_super',
                    'message': 'after vice branch, before super().update',
                    'data': {
                        'custom_vice_popped': custom_vice,
                        'validated_vice_fk': str(validated_data.get('vice')) if validated_data.get('vice') is not None else None,
                        'will_set_vice_from_custom': bool(custom_vice),
                    },
                    'timestamp': int(time.time() * 1000),
                }) + '\n')
        except Exception:
            pass
        # #endregion

        character = super().update(instance, validated_data)

        if character.crew_id and character.personal_crew_name:
            Character.objects.filter(pk=character.pk).update(personal_crew_name='')
            character.personal_crew_name = ''

        # #region agent log
        try:
            with open('/home/z/git/1-800-BIZARRE/.cursor/debug-af48c2.log', 'a') as _f:
                _f.write(json.dumps({
                    'sessionId': 'af48c2',
                    'hypothesisId': 'H3-H4',
                    'location': 'serializers.py:CharacterSerializer.update:after_super',
                    'message': 'after super().update',
                    'data': {
                        'character_vice_id': character.vice_id,
                        'character_image': bool(character.image),
                        'image_name': getattr(character.image, 'name', '')[:120] if character.image else '',
                    },
                    'timestamp': int(time.time() * 1000),
                }) + '\n')
        except Exception:
            pass
        # #endregion

        # Sync Stand stats when coin_stats or stand data is provided
        if coin_stats and isinstance(coin_stats, dict):
            stand, created = Stand.objects.get_or_create(
                character=character,
                defaults={
                    'name': character.stand_name or 'Unnamed Stand',
                    'type': 'FIGHTING',
                    'form': 'Humanoid',
                    'consciousness_level': 'C',
                    'power': 'D', 'speed': 'D', 'range': 'D',
                    'durability': 'D', 'precision': 'D', 'development': 'D',
                    'armor': 0,
                }
            )
            for field in ['power', 'speed', 'range', 'durability', 'precision', 'development']:
                grade = str(coin_stats.get(field, 'D')).upper()[:1]
                if grade in ('S', 'A', 'B', 'C', 'D', 'F'):
                    setattr(stand, field, grade)
            if stand_data and isinstance(stand_data, dict) and stand_data.get('name'):
                stand.name = stand_data['name']
            stand.save()

        if std_ids is not None:
            character.standard_abilities.set(std_ids)
        if hamon_ids is not None:
            character.hamon_abilities.all().delete()
            for ha in hamon_ids:
                CharacterHamonAbility.objects.create(character=character, hamon_ability=ha)
        if spin_ids is not None:
            character.spin_abilities.all().delete()
            for sa in spin_ids:
                CharacterSpinAbility.objects.create(character=character, spin_ability=sa)
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
        # obj.trauma is a list of Trauma IDs
        traumas = Trauma.objects.filter(id__in=obj.trauma)
        return TraumaSerializer(traumas, many=True).data


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
        fields = ['username', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        UserProfile.objects.create(user=user)
        return user

class CharacterSummarySerializer(serializers.ModelSerializer):
    heritage_name = serializers.CharField(source='heritage.name', read_only=True, default=None)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Character
        fields = ['id', 'true_name', 'alias', 'stand_name', 'playbook', 'heritage_name', 'user_id', 'username']


class NPCSummarySerializer(serializers.ModelSerializer):
    heritage_name = serializers.CharField(source='heritage.name', read_only=True, default=None)

    class Meta:
        model = NPC
        fields = ['id', 'name', 'level', 'stand_name', 'playbook', 'heritage_name']


class FactionSerializer(serializers.ModelSerializer):
    npcs = NPCSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Faction
        fields = ['id', 'name', 'campaign', 'faction_type', 'notes', 'level', 'hold', 'reputation', 'npcs']


class ShowcasedNPCSerializer(serializers.ModelSerializer):
    npc = serializers.SerializerMethodField()

    class Meta:
        model = ShowcasedNPC
        fields = ['id', 'campaign', 'npc', 'reveal_items', 'reveal_stand_stats', 'reveal_faction_status', 'show_clocks_to_party']

    def get_npc(self, obj):
        data = {
            'id': obj.npc.id,
            'name': obj.npc.name,
            'stand_name': obj.npc.stand_name or '',
        }
        if obj.reveal_items:
            data['inventory'] = obj.npc.inventory or []
            data['items'] = obj.npc.items or []
        if obj.reveal_stand_stats:
            data['stand_coin_stats'] = obj.npc.stand_coin_stats or {}
        if obj.reveal_faction_status:
            data['faction_status'] = obj.npc.faction_status or {}
        # Only include clock data when GM has enabled show_clocks_to_party
        if obj.show_clocks_to_party:
            data['harm_clock_current'] = obj.npc.harm_clock_current
            data['harm_clock_max'] = obj.npc.harm_clock_max
            data['vulnerability_clock_current'] = obj.npc.vulnerability_clock_current
            data['vulnerability_clock_max'] = obj.npc.vulnerability_clock_max
            data['conflict_clocks'] = obj.npc.conflict_clocks or []
            data['alt_clocks'] = obj.npc.alt_clocks or []
            clocks = list(obj.npc.progress_clocks.all().values('id', 'name', 'clock_type', 'max_segments', 'filled_segments', 'completed'))
            data['progress_clocks'] = clocks
        return data


class ProgressClockSerializer(serializers.ModelSerializer):
    clock_type_display = serializers.CharField(source='get_clock_type_display', read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)
    max_segments = serializers.IntegerField(min_value=1, max_value=12, default=4)

    class Meta:
        model = ProgressClock
        fields = [
            'id', 'name', 'clock_type', 'clock_type_display', 'max_segments', 'filled_segments',
            'description', 'campaign', 'crew', 'character', 'faction', 'session', 'npc',
            'visible_to_players', 'visible_to_party', 'created_by', 'created_at', 'completed'
        ]


class CampaignInvitationSerializer(serializers.ModelSerializer):
    invited_user = UserSerializer(read_only=True)
    invited_by = UserSerializer(read_only=True)
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)
    campaign_id = serializers.IntegerField(source='campaign.id', read_only=True)

    class Meta:
        model = CampaignInvitation
        fields = ['id', 'campaign_id', 'campaign_name', 'invited_user', 'invited_by', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']


class CampaignSerializer(serializers.ModelSerializer):
    gm = UserSerializer(read_only=True)
    players = UserSerializer(many=True, read_only=True)
    wanted_stars = serializers.IntegerField(required=False, default=0)
    factions = FactionSerializer(many=True, read_only=True)
    campaign_characters = CharacterSummarySerializer(source='characters', many=True, read_only=True)
    campaign_npcs = NPCSummarySerializer(source='npcs', many=True, read_only=True)
    pending_invitations = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(required=False, default=True)
    created_at = serializers.DateTimeField(read_only=True)
    active_session = serializers.PrimaryKeyRelatedField(queryset=Session.objects.all(), required=False, allow_null=True)
    active_session_detail = serializers.SerializerMethodField()
    sessions = serializers.SerializerMethodField()
    showcased_npcs = ShowcasedNPCSerializer(many=True, read_only=True)
    current_scene_type = serializers.ChoiceField(choices=Campaign.SCENE_TYPE_CHOICES, required=False, default='NONE')
    progress_clocks = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            'id', 'name', 'gm', 'players', 'description', 'wanted_stars',
            'is_active', 'created_at', 'factions', 'campaign_characters',
            'campaign_npcs', 'pending_invitations',
            'active_session', 'active_session_detail', 'sessions',
            'showcased_npcs', 'current_scene_type', 'progress_clocks',
        ]

    def get_pending_invitations(self, obj):
        invitations = obj.invitations.filter(status='pending')
        return CampaignInvitationSerializer(invitations, many=True).data

    def get_active_session_detail(self, obj):
        if not obj.active_session_id:
            return None
        s = obj.active_session
        involvements = s.npc_involvements.filter(show_clocks_to_players=True).select_related('npc')
        session_npcs_with_clocks = []
        for inv in involvements:
            npc = inv.npc
            clocks = list(npc.progress_clocks.all().values('id', 'name', 'clock_type', 'max_segments', 'filled_segments', 'completed'))
            session_npcs_with_clocks.append({
                'id': npc.id,
                'name': npc.name,
                'stand_name': npc.stand_name or '',
                'harm_clock_current': npc.harm_clock_current,
                'harm_clock_max': npc.harm_clock_max,
                'vulnerability_clock_current': npc.vulnerability_clock_current,
                'vulnerability_clock_max': npc.vulnerability_clock_max,
                'conflict_clocks': npc.conflict_clocks or [],
                'alt_clocks': npc.alt_clocks or [],
                'progress_clocks': clocks,
            })
        return {
            'id': s.id,
            'name': s.name,
            'description': s.description,
            'objective': s.objective,
            'show_position_effect_to_players': getattr(s, 'show_position_effect_to_players', True),
            'default_position': getattr(s, 'default_position', 'risky') or 'risky',
            'default_effect': getattr(s, 'default_effect', 'standard') or 'standard',
            'roll_goal_label': getattr(s, 'roll_goal_label', '') or '',
            'devils_bargain_by_character': getattr(s, 'devils_bargain_by_character', None) or {},
            'session_npcs_with_clocks': session_npcs_with_clocks,
        }

    def get_sessions(self, obj):
        sessions = obj.sessions.all().order_by('-session_date')[:50]
        return [{'id': s.id, 'name': s.name, 'session_date': s.session_date} for s in sessions]

    def get_progress_clocks(self, obj):
        from django.db.models import Q
        request = self.context.get('request')
        if not request or not request.user:
            return []
        is_gm = obj.gm_id == request.user.id
        clocks = obj.progress_clocks.all()
        if is_gm or request.user.is_staff:
            return ProgressClockSerializer(clocks, many=True).data
        user = request.user
        showcased_npc_ids = list(obj.showcased_npcs.values_list('npc_id', flat=True))
        campaign_player_ids = list(obj.players.values_list('id', flat=True)) + list(
            obj.characters.values_list('user_id', flat=True).distinct()
        )
        clocks = clocks.filter(
            Q(
                Q(created_by__isnull=True, visible_to_players=True)
                & (Q(npc__isnull=True) | Q(npc_id__in=showcased_npc_ids))
            )
            | Q(created_by_id=user.id)
            | Q(visible_to_party=True, created_by_id__in=campaign_player_ids)
        )
        return ProgressClockSerializer(clocks, many=True).data


class NPCSerializer(serializers.ModelSerializer):
    creator = serializers.PrimaryKeyRelatedField(read_only=True, default=serializers.CurrentUserDefault())
    heritage = FlexibleHeritagePrimaryKeyField(
        queryset=Heritage.objects.all(), allow_null=True, required=False
    )
    heritage_details = HeritageSerializer(source='heritage', read_only=True)
    harm_clock_max = serializers.IntegerField(read_only=True)
    special_armor_charges = serializers.IntegerField(read_only=True)
    vulnerability_clock_max = serializers.IntegerField(read_only=True)
    harm_clock_current = serializers.IntegerField(read_only=True)
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

    def get_selected_hamon_abilities(self, obj):
        return list(obj.npc_hamon_abilities.values_list('hamon_ability_id', flat=True))

    def get_selected_spin_abilities(self, obj):
        return list(obj.npc_spin_abilities.values_list('spin_ability_id', flat=True))

    class Meta:
        model = NPC
        fields = [
            'id', 'name', 'level', 'appearance', 'role', 'weakness', 'need', 'desire',
            'rumour', 'secret', 'passion', 'description', 'stand_coin_stats', 'stand_name',
            'heritage', 'heritage_details', 'playbook', 'custom_abilities', 'abilities',
            'hamon_ability_ids', 'spin_ability_ids', 'selected_hamon_abilities', 'selected_spin_abilities',
            'relationships', 'harm_clock_current', 'vulnerability_clock_current', 'armor_charges',
            'regular_armor_used', 'special_armor_used', 'creator', 'campaign', 'faction',
            'image', 'image_url', 'stand_description', 'stand_appearance', 'stand_manifestation',
            'special_traits', 'harm_clock_max', 'special_armor_charges', 'vulnerability_clock_max',
            'purveyor', 'notes', 'items', 'contacts', 'faction_status', 'inventory',
            'conflict_clocks', 'alt_clocks',
        ]

    def create(self, validated_data):
        hamon_ids = validated_data.pop('hamon_ability_ids', [])
        spin_ids = validated_data.pop('spin_ability_ids', [])
        if 'creator' not in validated_data:
            validated_data['creator'] = self.context['request'].user
        npc = super().create(validated_data)
        NPCHamonAbility.objects.bulk_create(
            [NPCHamonAbility(npc=npc, hamon_ability=ability) for ability in hamon_ids]
        )
        NPCSpinAbility.objects.bulk_create(
            [NPCSpinAbility(npc=npc, spin_ability=ability) for ability in spin_ids]
        )
        return npc

    def update(self, instance, validated_data):
        hamon_ids = validated_data.pop('hamon_ability_ids', None)
        spin_ids = validated_data.pop('spin_ability_ids', None)
        instance = super().update(instance, validated_data)
        if hamon_ids is not None:
            instance.npc_hamon_abilities.all().delete()
            NPCHamonAbility.objects.bulk_create(
                [NPCHamonAbility(npc=instance, hamon_ability=ability) for ability in hamon_ids]
            )
        if spin_ids is not None:
            instance.npc_spin_abilities.all().delete()
            NPCSpinAbility.objects.bulk_create(
                [NPCSpinAbility(npc=instance, spin_ability=ability) for ability in spin_ids]
            )
        return instance


class TraumaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trauma
        fields = ['id', 'name', 'description']
