from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Heritage, Vice, Ability, Character, Stand,
    Campaign, NPC, Crew, Detriment, Benefit, StandAbility,
    HamonAbility, SpinAbility
)

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
            'tier', 'hold', 'rep', 'heat', 'wanted_level',
            'coin', 'stash', 'claims', 'upgrades'
        ]

class CharacterSerializer(serializers.ModelSerializer):
    stand = StandSerializer(read_only=True)
    crew = CrewSerializer(read_only=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    heritage_details = HeritageSerializer(source='heritage', read_only=True)
    vice_details = ViceSerializer(source='vice', read_only=True)
    special_ability_details = AbilitySerializer(source='special_ability', read_only=True)

    selected_benefits = serializers.PrimaryKeyRelatedField(
        queryset=Benefit.objects.all(), many=True, required=False
    )
    selected_detriments = serializers.PrimaryKeyRelatedField(
        queryset=Detriment.objects.all(), many=True, required=False
    )

    custom_vice = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Character
        fields = '__all__'

    def validate(self, data):
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

        return data

    def create(self, validated_data):
        custom_vice = validated_data.pop('custom_vice', None)

        if custom_vice:
            vice = Vice.objects.create(name=custom_vice, description="Custom vice")
            validated_data['vice'] = vice

        return super().create(validated_data)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model  = User
        fields = ['username','password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Campaign
        fields = '__all__'

class NPCSerializer(serializers.ModelSerializer):
    class Meta:
        model  = NPC
        fields = '__all__'
