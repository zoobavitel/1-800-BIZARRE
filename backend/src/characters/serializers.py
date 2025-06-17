from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Heritage, Vice, Ability, Character, Stand,
    Campaign, NPC, Crew, Detriment, Benefit, StandAbility,
    HamonAbility, SpinAbility, Trauma
    , CharacterHamonAbility, CharacterSpinAbility
)
import re

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

class ViceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vice
        fields = '__all__'

class AbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Ability
        fields = ['id', 'name', 'description', 'type']

class StandAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = StandAbility
        fields = ['id','stand','name','description']

class HamonAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = HamonAbility
        fields = ['id', 'name', 'hamon_type', 'description', 'stress_cost', 'frequency']

class SpinAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SpinAbility
        fields = ['id', 'name', 'spin_type', 'description', 'stress_cost', 'frequency']

class StandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stand
        fields = '__all__'

class CrewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Crew
        fields = [
            'id', 'name', 'campaign', 'description',
            'tier', 'hold', 'rep', 'wanted_level',
            'coin', 'stash', 'claims', 'upgrades'
        ]

class CharacterSerializer(serializers.ModelSerializer):
    # display current campaign's wanted stars
    wanted_stars = serializers.IntegerField(source='campaign.wanted_stars', read_only=True)
    stand = StandSerializer(read_only=True)
    crew = CrewSerializer(read_only=True)
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

    class Meta:
        model = Character
        fields = '__all__'

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
        
        # enforce playbook ability prerequisites based on coin_stats
        # count 'A' ratings in coin_stats
        coin_stats = data.get('coin_stats') or getattr(self.instance, 'coin_stats', {})
        count_A = sum(1 for v in coin_stats.values() if v == 'A')
        # validate requested Hamon abilities
        for ha in data.get('hamon_ability_ids', []):
            m = re.match(r"^(\d)A", ha.name)
            if m and count_A < int(m.group(1)):
                raise serializers.ValidationError(
                    f"Insufficient 'A' ratings: need {m.group(1)} 'A's to select Hamon ability '{ha.name}' (you have {count_A})."
                )
        # validate requested Spin abilities
        for sa in data.get('spin_ability_ids', []):
            m = re.match(r"^(\d)A", sa.name)
            if m and count_A < int(m.group(1)):
                raise serializers.ValidationError(
                    f"Insufficient 'A' ratings: need {m.group(1)} 'A's to select Spin ability '{sa.name}' (you have {count_A})."
                )
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
        # sum all dot values
        total_dots = sum(val for group in action_dots.values() for val in group.values())
        if total_dots > 7:
            extra_dice = total_dots - 7
            # each extra die costs 5 XP
            xp_gained = sum(entry.xp_gained for entry in self.instance.experience_entries.all()) if self.instance else 0
            max_dice_from_xp = xp_gained // 5
            if extra_dice > max_dice_from_xp:
                required_xp = extra_dice * 5
                raise serializers.ValidationError(
                    f"Not enough XP: {extra_dice} extra dice require {required_xp} XP (5 XP each), but only {xp_gained} XP available."
                )
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
        
        return data

    def create(self, validated_data):
        custom_vice = validated_data.pop('custom_vice', None)
        # extract playbook abilities
        hamon_ids = validated_data.pop('hamon_ability_ids', [])
        spin_ids = validated_data.pop('spin_ability_ids', [])
        # extract standard abilities
        std_ids = validated_data.pop('standard_abilities', [])

        if custom_vice:
            vice = Vice.objects.create(name=custom_vice, description="Custom vice")
            validated_data['vice'] = vice

        # create character instance and assign m2m
        character = super().create(validated_data)
        # assign standard abilities
        character.standard_abilities.set(std_ids)
        # assign hamon abilities
        for ha in hamon_ids:
            CharacterHamonAbility.objects.create(character=character, hamon_ability=ha)
        # assign spin abilities
        for sa in spin_ids:
            CharacterSpinAbility.objects.create(character=character, spin_ability=sa)
        return character
    
    def update(self, instance, validated_data):
        # handle custom vice
        custom_vice = validated_data.pop('custom_vice', None)
        hamon_ids = validated_data.pop('hamon_ability_ids', None)
        spin_ids = validated_data.pop('spin_ability_ids', None)
        # extract standard abilities
        std_ids = validated_data.pop('standard_abilities', None)
        if custom_vice:
            vice = Vice.objects.create(name=custom_vice, description="Custom vice")
            validated_data['vice'] = vice
        character = super().update(instance, validated_data)
        # update standard abilities
        if std_ids is not None:
            character.standard_abilities.set(std_ids)
        # update playbook abilities: clear and reassign if provided
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
    password = serializers.CharField(write_only=True)

    class Meta:
        model  = User
        fields = ['username','password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class CampaignSerializer(serializers.ModelSerializer):
    # wanted stars may be set by GM
    wanted_stars = serializers.IntegerField()
    class Meta:
        model  = Campaign
        fields = ['id','name','gm','players','description','wanted_stars']

class NPCSerializer(serializers.ModelSerializer):
    class Meta:
        model  = NPC
        fields = '__all__'

class TraumaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trauma
        fields = ['id', 'name', 'description']
