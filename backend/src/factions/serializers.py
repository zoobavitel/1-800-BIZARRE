from rest_framework import serializers
from .models import Faction, FactionRelationship, CrewFactionRelationship
# from crews.models import Crew # Will be uncommented once Crew model is moved

class FactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Faction
        fields = '__all__'

class FactionRelationshipSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactionRelationship
        fields = '__all__'

class CrewFactionRelationshipSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrewFactionRelationship
        fields = '__all__'